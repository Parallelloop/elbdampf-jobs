import GetGrapqlClient from "./graphql-client";

const createShopifyOrder = async (orderData) => {
  try {
    const graphClient = GetGrapqlClient({ scopes: ["write_orders"] });
    const { lineItems, shippingAddress, amazonOrderId, buyerEmail, totalAmount, shippingLines } = orderData;

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
        email: buyerEmail,
        lineItems: lineItems,
        shippingAddress: shippingAddress || null,
        billingAddress: shippingAddress || null,
        note: `Imported from Amazon Order ID: ${amazonOrderId}`,
        financialStatus: "PAID",
        tags: [`Amazon`],
        customAttributes: [
          { key: "Amazon Order ID", value: String(amazonOrderId) },
          { key: "FulfillmentChannel", value: "MFN" },
          { key: "ShipServiceLevel", value: "Priority" },
          { key: "Notice", value: "This marketplace order has been imported automatically by our Custom app." },
        ],
        shippingLines: shippingLines || [],
      },
      transactions: [
        {
          kind: "SALE",
          status: "SUCCESS",
          gateway: "Amazon",
          amountSet: {
            shopMoney: {
              amount: totalAmount,
              currencyCode: "EUR",
            },
          },
        },
      ],
      options: null
    };

    const response = await graphClient.request(mutation, { variables });

    const { userErrors, order } = response?.data?.orderCreate || {};
    if (userErrors && userErrors.length > 0) {
      console.log("🚀 ~ createShopifyOrder ~ userErrors:", userErrors)
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

const getShopifyOrder = async (shopifyOrderId) => {
  try {
    if (!shopifyOrderId) {
      return { success: false, error: "No Shopify Order ID provided" };
    }

    const graphClient = GetGrapqlClient({ scopes: ["read_orders"] });

    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          note
          customAttributes {
            key
            value
          }
        }
      }
    `;

    const variables = {
      id: `gid://shopify/Order/${shopifyOrderId}`,
    };

    const response = await graphClient.request(query, { variables });
    const order = response?.data?.order;
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const amazonOrderId =
      order.customAttributes?.find(
        (attr) => attr.key === "Amazon Order ID"
      )?.value ||
      // fallback to note
      order.note?.match(/\d{3}-\d{7}-\d{7}/)?.[0] ||
      null;

    console.log("✅ Amazon Order ID:", amazonOrderId);

    return {
      success: true,
      shopifyOrderId,
      amazonOrderId,
      order,
    };
  } catch (error) {
    console.error("❌ getShopifyOrder failed:", error);
    return { success: false, error: error.message };
  }
};


export {
  createShopifyOrder,
  checkShopifyOrder,
  getShopifyOrder
}