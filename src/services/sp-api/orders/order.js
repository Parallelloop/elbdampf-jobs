import getSpAPIClient from "../client";
import getRDTNtoken from "../get-RDTN";

const fetchAmazonFBMOrders = async (lastUpdatedAfter = '2025-11-01T12:10:02') => {
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

const fetchAmazonFBMOrdersPage = async ({ nextToken, lastUpdatedAfter }) => {
  try {
    const spClient = getSpAPIClient();
    const restrictedDataToken = await getRDTNtoken({ spClient });
  
    let params = {};
  
    if (nextToken) {
      params = { NextToken: nextToken };
    } else {
      params = {
        MarketplaceIds: ['A1PA6795UKMFR9'],
        LastUpdatedAfter: lastUpdatedAfter,
        FulfillmentChannels: ['MFN'],
        OrderStatuses: ['Unshipped'],
        // AmazonOrderIds: ["302-5234022-6841118"],
        MaxResultsPerPage: 100,
      };
    }
  
    const res = await spClient.callAPI({
      operation: "getOrders",
      endpoint: "orders",
      query: params,
      restricted_data_token: restrictedDataToken,
    });
    return {
      amazonOrders: res?.Orders || [],
      nextToken: res?.NextToken || null
    };
  } catch (error) {
    console.log("🚀 ~ fetchAmazonFBMOrdersPage ~ error:", error)
    return {
      amazonOrders: [],
      nextToken: null
    };
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
  fetchAmazonFBMOrdersPage,
  fetchAmazonOrderItems
};
