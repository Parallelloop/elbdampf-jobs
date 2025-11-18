import getSpAPIClient from "./client";
import getRDTNtoken from "./get-RDTN";

const fetchAmazonFBMOrders = async (lastUpdatedAfter = '2025-10-01T12:10:02') => {
  try {
    const spClient = getSpAPIClient();
    const restrictedDataToken = await getRDTNtoken({ spClient });
    
    const res = await spClient.callAPI({
      operation: 'getOrders',
      endpoint: 'orders',
      query: {
        MarketplaceIds: ['A1PA6795UKMFR9'],
        LastUpdatedAfter: lastUpdatedAfter,
        FulfillmentChannels: ['MFN'],
        MaxResultsPerPage: 1,
      },
      restricted_data_token: restrictedDataToken,
    });
    return res;
  } catch (error) {
    return false;
  }
};

const fetchAmazonOrderItems = async (orderId) => {
  try {
    const spClient = getSpAPIClient();

    const data = await spClient.callAPI({
      operation: "getOrderItems",
      endpoint: "orders",
      path: {
        orderId
      },
    });
    return data;
  } catch (error) {
    return false;
  }
};

export {
  fetchAmazonFBMOrders,
  fetchAmazonOrderItems
};
