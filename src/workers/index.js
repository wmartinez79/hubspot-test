const Domain = require("../database/Domain");

const { getWorker } = require("./workerFactory");
const hubspotClient = require("../services/hubspotClient");
const { createQueue, drainQueue } = require("../services/queue");

const pullDataFromHubspot = async () => {
  console.log("start pulling data from HubSpot");

  const domain = await Domain.findOne({});

  for (const account of domain.integrations.hubspot.accounts) {
    console.log("start processing account");

    try {
      await hubspotClient.refreshAccessToken(domain, account.hubId);
    } catch (err) {
      console.log(err, {
        apiKey: domain.apiKey,
        metadata: { operation: "refreshAccessToken" },
      });
    }

    const actions = [];
    const q = createQueue(domain, actions);

    const entitiesToProcess = ["companies", "contacts", "meetings"];

    for (const entity of entitiesToProcess) {
      try {
        console.log(`--> Starting worker process ${entity} ...`);
        const worker = getWorker(entity);
        await worker.process(domain, account.hubId, q, hubspotClient);
        console.log(`** worker process ${entity} completed`);
      } catch (err) {
        console.log(err, {
          apiKey: domain.apiKey,
          metadata: { operation: `process${entity}`, hubId: account.hubId },
        });
      }
    }
    try {
      await drainQueue(domain, actions, q);
      console.log("drain queue");
    } catch (err) {
      console.log(err, {
        apiKey: domain.apiKey,
        metadata: { operation: "drainQueue", hubId: account.hubId },
      });
    }

    await hubspotClient.saveDomain(domain);

    console.log("finish processing account");
  }

  process.exit();
};

module.exports = pullDataFromHubspot;
