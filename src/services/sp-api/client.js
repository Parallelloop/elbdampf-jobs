import { SellingPartner } from "amazon-sp-api";
const {
  SELLING_PARTNER_APP_CLIENT_ID,
  SELLING_PARTNER_APP_CLIENT_SECRET,
  SELLING_PARTNER_APP_REFRESH_TOKEN,
} = process.env;

const getSpAPIClient = () => {
  const Client = new SellingPartner({
    region: "eu",
    credentials: {
      SELLING_PARTNER_APP_CLIENT_ID,
      SELLING_PARTNER_APP_CLIENT_SECRET,
    },
    refresh_token: SELLING_PARTNER_APP_REFRESH_TOKEN,
  });
  return Client;
};

export default getSpAPIClient;
