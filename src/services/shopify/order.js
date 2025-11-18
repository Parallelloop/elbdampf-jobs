import GetGrapqlClient from "./graphql-client";

const createShopifyOrder = async (orderData) => {
  try {
    const graphClient = GetGrapqlClient({ scopes: ["write_orders"] });
    const { lineItems, shippingAddress, amazonOrderId } = orderData;

    const shippingLine = shippingAddress?.shippingLine || null;

    const mutation = `
          mutation orderCreate(
            $order: OrderCreateOrderInput!,
            $options: OrderCreateOptionsInput
          ) {
            orderCreate(order: $order, options: $options) {
              userErrors {
                field
                message
              }
              order {
                id
                name
                createdAt
                totalTaxSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                lineItems(first: 5) {
                  nodes {
                    variant {
                      id
                    }
                    id
                    title
                    quantity
                    taxLines {
                      title
                      rate
                      priceSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
          }
      `;

    const variables = {
      order: {
        email: shippingAddress?.email || "",
        lineItems: lineItems,
        shippingAddress: shippingAddress ? shippingAddress : null,
        tags: [`AMAZON_ORDER:${amazonOrderId}`],
        customAttributes: [
          { key: "Amazon Order ID", value: String(amazonOrderId) },
          { key: "FulfillmentChannel", value: "MFN" },
        ],
        shippingLines: shippingLine ? [shippingLine] : [],
      },
      options: null
    };

    const response = await graphClient.request(mutation, { variables });

    const { userErrors, order } = response?.data?.orderCreate || {};
    if (userErrors && userErrors.length > 0) {
      return { success: false, errors: userErrors };
    }

    return { success: true, order };
  } catch (error) {
    console.error("❌ Shopify order creation failed:", error);
    return { success: false, error: error.message };

  }
};

const checkShopifyOrder = async (amazonOrderId, email) => {
  try {
    if (!email) {
      console.log("⚠️ No email provided for checking Shopify order");
      return { success: false, error: "No email provided" };
    }
    if (!amazonOrderId) {
      console.log("⚠️ No Amazon Order ID provided for checking Shopify order");
      return { success: false, error: "No Amazon Order ID provided" };
    }
    const graphClient = GetGrapqlClient({ scopes: ["read_orders"] });
    const query = `
        query Orders($query: String!) {
          orders(first: 10, query: $query) {
            edges {
              node {
                id
                name
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      `;

    const variables = {
      query: `email:${email}`
    };

    const response = await graphClient.request(query, { variables });
    const edges = response?.data?.orders?.edges || [];

    const filteredEdges = edges?.filter(edge => {
      const customAttributes = edge.node.customAttributes || [];
      const amazonOrderAttribute = customAttributes.find(attr => attr.key === "Amazon Order ID");

      if (!amazonOrderAttribute) return false;

      const cleanValue = amazonOrderAttribute.value.replace(/\s*\(--\)$/, "");

      return cleanValue === amazonOrderId;
    });

    console.log("🚀 ~ checkShopifyOrder ~ filteredEdges:", JSON.stringify(filteredEdges, null, 2));

    if (!filteredEdges.length) {
      console.log("⚠️ No Shopify orders found for this Amazon Order ID");
      return { success: false, edges: [] };
    }
    const shopifyOrder = filteredEdges?.length > 0 ? [filteredEdges[0].node] : [];

    return { success: true, edges: shopifyOrder };
  } catch (error) {
    console.error("❌ Shopify order creation failed:", error);
    return { success: false, error: error.message };

  }
};

export {
  createShopifyOrder,
  checkShopifyOrder
}