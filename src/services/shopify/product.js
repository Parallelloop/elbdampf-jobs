import GetGrapqlClient from "./graphql-client";

const findVariantProduct = async ({ query, first = 1 }) => {
  try {
    const client = GetGrapqlClient({ scopes: ["read_products"] });

    const response = await client.request(
      `
        query ProductVariants($first: Int!, $query: String!) {
          productVariants(first: $first, query: $query) {
            nodes {
              availableForSale
              barcode
              compareAtPrice
              createdAt
              defaultCursor
              displayName
              id
              inventoryPolicy
              inventoryQuantity
              legacyResourceId
              position
              price
              requiresComponents
              sellableOnlineQuantity
              sellingPlanGroupCount
              sku
              storefrontId
              taxCode
              taxable
              title
              updatedAt
            }
          }
        }
      `,
      {
        variables: {
          first,
          query,
        },
      }
    );
    
    const variants = response?.data?.productVariants?.nodes || [];

    return {
      success: true,
      variants,
    };

  } catch (error) {
    console.error("❌ Shopify getting variant query failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export {
    findVariantProduct
}
