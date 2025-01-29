const {
  generateLastModifiedDateFilter,
  filterNullValuesFromObject,
} = require("../utils/utils");
const {
  CONTACT_PROPERTIES,
  PAGE_SIZE,
  MAX_RETRIES,
} = require("../utils/constants");

const process = async (domain, hubId, q, hubspotClient) => {
  const account = domain.integrations.hubspot.accounts.find(
    (account) => account.hubId === hubId
  );

  const lastPulledDate = new Date(account.lastPulledDates.contacts);
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = PAGE_SIZE;

  while (hasMore) {
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const lastModifiedDateFilter = generateLastModifiedDateFilter(
      lastModifiedDate,
      now,
      "lastmodifieddate"
    );
    const searchObject = {
      filterGroups: [lastModifiedDateFilter],
      sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
      properties: CONTACT_PROPERTIES,
      limit,
      after: offsetObject.after,
    };

    let searchResult = {};

    let tryCount = 0;
    while (tryCount <= MAX_RETRIES) {
      try {
        searchResult =
          await hubspotClient.client.crm.contacts.searchApi.doSearch(
            searchObject
          );
        break;
      } catch (err) {
        console.log("Search Contacts Api error: ", err);
        tryCount++;

        if (new Date() > hubspotClient.getExpirationDate())
          await hubspotClient.refreshAccessToken(domain, hubId);

        await new Promise((resolve, reject) =>
          setTimeout(resolve, 5000 * Math.pow(2, tryCount))
        );
      }
    }

    if (!searchResult)
      throw new Error("Failed to fetch contacts for the 4th time. Aborting.");

    const data = searchResult.results || [];

    console.log("fetch contact batch");

    offsetObject.after = parseInt(searchResult.paging?.next?.after);
    const contactIds = data.map((contact) => contact.id);

    // contact to company association
    const contactsToAssociate = contactIds;
    const companyAssociationsResults =
      (
        await (
          await hubspotClient.client.apiRequest({
            method: "post",
            path: "/crm/v3/associations/CONTACTS/COMPANIES/batch/read",
            body: {
              inputs: contactsToAssociate.map((contactId) => ({
                id: contactId,
              })),
            },
          })
        ).json()
      )?.results || [];

    const companyAssociations = Object.fromEntries(
      companyAssociationsResults
        .map((a) => {
          if (a.from) {
            contactsToAssociate.splice(
              contactsToAssociate.indexOf(a.from.id),
              1
            );
            return [a.from.id, a.to[0].id];
          } else return false;
        })
        .filter((x) => x)
    );

    data.forEach((contact) => {
      if (!contact.properties || !contact.properties.email) return;

      const companyId = companyAssociations[contact.id];

      const isCreated = new Date(contact.createdAt) > lastPulledDate;

      const userProperties = {
        company_id: companyId,
        contact_name: (
          (contact.properties.firstname || "") +
          " " +
          (contact.properties.lastname || "")
        ).trim(),
        contact_title: contact.properties.jobtitle,
        contact_source: contact.properties.hs_analytics_source,
        contact_status: contact.properties.hs_lead_status,
        contact_score: parseInt(contact.properties.hubspotscore) || 0,
      };

      const actionTemplate = {
        includeInAnalytics: 0,
        identity: contact.properties.email,
        userProperties: filterNullValuesFromObject(userProperties),
      };
      q.push({
        actionName: isCreated ? "Contact Created" : "Contact Updated",
        actionDate: new Date(isCreated ? contact.createdAt : contact.updatedAt),
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

  account.lastPulledDates.contacts = now;
  await hubspotClient.saveDomain(domain);

  return true;
};

module.exports = {
  process,
};
