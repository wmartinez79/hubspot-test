const { generateLastModifiedDateFilter } = require("../utils/utils");
const {
  COMPANY_PROPERTIES,
  PAGE_SIZE,
  MAX_RETRIES,
} = require("../utils/constants");

const process = async (domain, hubId, q, hubspotClient) => {
  const account = domain.integrations.hubspot.accounts.find(
    (account) => account.hubId === hubId
  );
  const lastPulledDate = new Date(account.lastPulledDates.companies);

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
      properties: COMPANY_PROPERTIES,
      limit,
      after: offsetObject.after,
    };

    let searchResult = {};

    let tryCount = 0;
    while (tryCount <= MAX_RETRIES) {
      try {
        searchResult =
          await hubspotClient.client.crm.companies.searchApi.doSearch(
            searchObject
          );
        break;
      } catch (err) {
        console.log("Search Companies Api error: ", err);
        tryCount++;

        if (new Date() > hubspotClient.getExpirationDate())
          await hubspotClient.refreshAccessToken(domain, hubId);

        await new Promise((resolve, reject) =>
          setTimeout(resolve, 5000 * Math.pow(2, tryCount))
        );
      }
    }

    if (!searchResult)
      throw new Error("Failed to fetch companies for the 4th time. Aborting.");

    const data = searchResult?.results || [];
    offsetObject.after = parseInt(searchResult?.paging?.next?.after);

    console.log("fetch company batch");

    data.forEach((company) => {
      if (!company.properties) return;

      const actionTemplate = {
        includeInAnalytics: 0,
        companyProperties: {
          company_id: company.id,
          company_domain: company.properties.domain,
          company_industry: company.properties.industry,
        },
      };

      const isCreated =
        !lastPulledDate || new Date(company.createdAt) > lastPulledDate;

      q.push({
        actionName: isCreated ? "Company Created" : "Company Updated",
        actionDate:
          new Date(isCreated ? company.createdAt : company.updatedAt) - 2000,
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
    hasMore = false;
  }
  account.lastPulledDates.companies = now;
  await hubspotClient.saveDomain(domain);

  return true;
};

module.exports = {
  process,
};
