const { DISALLOWED_VALUES } = require("./constants");

const filterNullValuesFromObject = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(
      ([_, v]) =>
        v !== null &&
        v !== "" &&
        typeof v !== "undefined" &&
        (typeof v !== "string" ||
          !DISALLOWED_VALUES.includes(v.toLowerCase()) ||
          !v.toLowerCase().includes("!$record"))
    )
  );

const normalizePropertyName = (key) =>
  key
    .toLowerCase()
    .replace(/__c$/, "")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

const goal = (actions) => {
  // this is where the data will be written to the database
  for (const action of actions) {
    console.log(action);
  }
};

const generateLastModifiedDateFilter = (
  date,
  nowDate,
  propertyName = "hs_lastmodifieddate"
) => {
  const lastModifiedDateFilter = date
    ? {
        filters: [
          { propertyName, operator: "GTE", value: `${date.valueOf()}` },
          { propertyName, operator: "LTE", value: `${nowDate.valueOf()}` },
        ],
      }
    : {};

  return lastModifiedDateFilter;
};

module.exports = {
  filterNullValuesFromObject,
  normalizePropertyName,
  goal,
  generateLastModifiedDateFilter,
};
