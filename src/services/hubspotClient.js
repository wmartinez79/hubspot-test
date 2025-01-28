const hubspot = require("@hubspot/api-client");
const { get } = require("lodash");

class HubSpotClient {
  constructor() {
    const propertyPrefix = "hubspot__";
    this.accessToken = null;
    this.client = new hubspot.Client({ accessToken: "" });
    this.expirationDate = null;
  }

  /**
   * Get access token from HubSpot
   */
  refreshAccessToken = async (domain, hubId, tryCount) => {
    const { HUBSPOT_CID, HUBSPOT_CS } = process.env;
    const account = domain.integrations.hubspot.accounts.find(
      (account) => account.hubId === hubId
    );
    const { accessToken, refreshToken } = account;

    return this.client.oauth.tokensApi
      .createToken(
        "refresh_token",
        undefined,
        undefined,
        HUBSPOT_CID,
        HUBSPOT_CS,
        refreshToken
      )
      .then(async (result) => {
        const body = result.body ? result.body : result;

        const newAccessToken = body.accessToken;
        this.expirationDate = new Date(
          body.expiresIn * 1000 + new Date().getTime()
        );

        this.client.setAccessToken(newAccessToken);
        if (newAccessToken !== accessToken) {
          account.accessToken = newAccessToken;
        }

        return true;
      });
  };

  saveDomain = async (domain) => {
    // disable this for testing purposes
    // return;
    domain.markModified("integrations.hubspot.accounts");
    await domain.save();
  };

  getExpirationDate = () => {
    return this.expirationDate;
  };
}

module.exports = new HubSpotClient();
