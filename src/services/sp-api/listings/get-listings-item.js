const getListingsItem = async ({ client, sku }) => {
  const response = await client.callAPI({
    operation: "getListingsItem",
    endpoint: "listingsItems",
    path: {
      sellerId: "A2XZLZDZR4H3UG",
      sku,
    },
    query: {
       marketplaceIds: ["A1PA6795UKMFR9"],
    },
  });

  return response;
};

export default getListingsItem;
