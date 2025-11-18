import '@shopify/shopify-api/adapters/node';

import { shopifyApi, Session, ApiVersion } from "@shopify/shopify-api";

const {
  SHOPIFY_ACCESS_KEY,
  SHOPIFY_ACCESS_SECRET,
  SHOPIFY_HOST,
  SHOPIFY_SHOP,
  SHOPIFY_ADMIN_TOKEN,
} = process.env;

const GetGrapqlClient = ({ scopes }) => {
  const shopify = shopifyApi({
    apiKey: SHOPIFY_ACCESS_KEY,
    apiSecretKey: SHOPIFY_ACCESS_SECRET,
    scopes,
    hostName: SHOPIFY_HOST,
    apiVersion: ApiVersion.April25,
  });
  const session = new Session({
    shop: SHOPIFY_SHOP,
    accessToken: SHOPIFY_ADMIN_TOKEN,
  });
  const client = new shopify.clients.Graphql({ session });
  return client;
};

export default GetGrapqlClient;
