const companiesWorker = require("./companiesWorker");
const contactsWorker = require("./contactsWorker");
const meetingsWorker = require("./meetingsWorker");

const workers = {
  companies: companiesWorker,
  contacts: contactsWorker,
  meetings: meetingsWorker,
};

const getWorker = (entity) => {
  const worker = workers[entity];
  if (!worker) {
    throw new Error(`Worker ${workerName} not found`);
  }
  return worker;
};

module.exports = {
  getWorker,
};
