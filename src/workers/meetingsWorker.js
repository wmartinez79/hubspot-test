const { generateLastModifiedDateFilter } = require("../utils/utils");
const {
  MEETING_PROPERTIES,
  PAGE_SIZE,
  MAX_RETRIES,
} = require("../utils/constants");

const process = async (domain, hubId, q, hubspotClient) => {
  const account = domain.integrations.hubspot.accounts.find(
    (account) => account.hubId === hubId
  );

  const lastPulledDate = new Date(
    account.lastPulledDates.meetings || new Date(0)
  );
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = PAGE_SIZE;

  while (hasMore) {
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const lastModifiedDateFilter = generateLastModifiedDateFilter(
      lastModifiedDate,
      now
    );
    const searchObject = {
      filterGroups: [lastModifiedDateFilter],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      properties: MEETING_PROPERTIES,
      limit,
      after: offsetObject.after,
    };

    let searchResult = {};

    let tryCount = 0;
    while (tryCount <= MAX_RETRIES) {
      try {
        searchResult =
          await hubspotClient.client.crm.objects.meetings.searchApi.doSearch(
            searchObject
          );
        break;
      } catch (err) {
        console.log("Search Meetings Api error: ", err);
        tryCount++;

        if (new Date() > hubspotClient.getExpirationDate())
          await hubspotClient.refreshAccessToken(domain, hubId);

        await new Promise((resolve, reject) =>
          setTimeout(resolve, 5000 * Math.pow(2, tryCount))
        );
      }
    }

    if (!searchResult)
      throw new Error("Failed to fetch meetings for the 4th time. Aborting.");

    const data = searchResult?.results || [];
    offsetObject.after = parseInt(searchResult?.paging?.next?.after);

    console.log("fetch meeting batch");
    const meetingIds = data.map((meeting) => meeting.id);

    const meetingsToAssociate = meetingIds;
    const contactAssociationsResults =
      (
        await (
          await hubspotClient.client.apiRequest({
            method: "post",
            path: "/crm/v3/associations/MEETINGS/CONTACTS/batch/read",
            body: {
              inputs: meetingsToAssociate.map((meetingId) => ({
                id: meetingId,
              })),
            },
          })
        ).json()
      )?.results || [];

    const contactAssociations = Object.fromEntries(
      contactAssociationsResults
        .map((a) => {
          if (a.from) {
            meetingsToAssociate.splice(
              meetingsToAssociate.indexOf(a.from.id),
              1
            );
            return [a.from.id, a.to[0].id];
          } else return false;
        })
        .filter((x) => x)
    );
    const uniqueContactIds = new Set(Object.values(contactAssociations));
    const contactIds = [...uniqueContactIds];
    const contactData =
      (
        await (
          await hubspotClient.client.apiRequest({
            method: "post",
            path: "/crm/v3/objects/contacts/batch/read",
            body: {
              inputs: contactIds.map((contactId) => ({
                id: contactId,
              })),
            },
          })
        ).json()
      )?.results || [];

    data.forEach((meeting) => {
      const contactId = contactAssociations[meeting.id];
      const contact = contactData.find((c) => c.id === contactId);
      if (!contact || !contact.properties || !contact.properties.email) return;

      const isCreated =
        !lastPulledDate || new Date(meeting.createdAt) > lastPulledDate;

      const actionTemplate = {
        includeInAnalytics: 0,
        identity: contact.properties.email,
        meetingProperties: {
          meeting_id: meeting.id,
          meeting_title: meeting.properties.hs_meeting_title,
          meeting_timestamp: meeting.properties.hs_timestamp,
        },
      };
      q.push({
        actionName: isCreated ? "Meeting Created" : "Meeting Updated",
        actionDate: new Date(isCreated ? meeting.createdAt : meeting.updatedAt),
        ...actionTemplate,
      });
    });

    if (!offsetObject?.after) {
      hasMore = false;
      break;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(
        data[data.length - 1].updatedAt
      ).valueOf();
    }
  }
  account.lastPulledDates.meetings = now;
  await hubspotClient.saveDomain(domain);
  return true;
};

module.exports = {
  process,
};
