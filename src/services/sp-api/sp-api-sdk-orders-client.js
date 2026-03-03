import { Orders_v2026SpApi } from '@amazon-sp-api-release/amazon-sp-api-sdk-js';
import { appConfig } from '../../utils/generators';

const {
  SELLING_PARTNER_APP_CLIENT_ID,
  SELLING_PARTNER_APP_CLIENT_SECRET,
  SELLING_PARTNER_APP_REFRESH_TOKEN,
} = process.env;

const apiClient = new Orders_v2026SpApi.ApiClient(
  appConfig.spApiEUEndpoint
);

apiClient.enableAutoRetrievalAccessToken(
  SELLING_PARTNER_APP_CLIENT_ID,
  SELLING_PARTNER_APP_CLIENT_SECRET,
  SELLING_PARTNER_APP_REFRESH_TOKEN,
  null
);

const searchOrdersApi = new Orders_v2026SpApi.SearchOrdersApi(apiClient);
const getOrderApi = new Orders_v2026SpApi.GetOrderApi(apiClient);

export {
  searchOrdersApi,
  getOrderApi
};