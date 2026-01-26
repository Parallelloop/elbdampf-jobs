const getListingsItem = async ({ client, sku }) => {
  try {
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
  } catch (error) {
    // ⛔️ Do NOT throw
    console.warn(`⚠️ SKU not found or failed: ${sku}`);
    return null;
  }
};

export default getListingsItem;
