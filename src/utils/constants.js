const DISALLOWED_VALUES = [
  "[not provided]",
  "placeholder",
  "[[unknown]]",
  "not set",
  "not provided",
  "unknown",
  "undefined",
  "n/a",
];

const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "country",
  "industry",
  "description",
  "annualrevenue",
  "numberofemployees",
  "hs_lead_status",
];

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "jobtitle",
  "email",
  "hubspotscore",
  "hs_lead_status",
  "hs_analytics_source",
  "hs_latest_source",
];

const MEETING_PROPERTIES = ["hs_meeting_title", "hs_timestamp"];

const PAGE_SIZE = 100;

const MAX_RETRIES = 4;

module.exports = {
  DISALLOWED_VALUES,
  COMPANY_PROPERTIES,
  CONTACT_PROPERTIES,
  MEETING_PROPERTIES,
  PAGE_SIZE,
  MAX_RETRIES,
};
