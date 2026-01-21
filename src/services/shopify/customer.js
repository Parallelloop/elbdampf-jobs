import GetGrapqlClient from "./graphql-client";

const getCustomerByEmail = async (email) => {
  try {
    const client = GetGrapqlClient({ scopes: ["read_customers"] });

    const response = await client.request(
      `
        query GetCustomerByEmail($query: String!) {
          customers(first: 2, query: $query) {
            edges {
              node {
                id
                email
                firstName
                lastName
                metafield(namespace: "custom", key: "delivery_method") {
                  id
                  value
                  type
                  namespace
                }
                createdAt
                updatedAt
                numberOfOrders
                state
                verifiedEmail
                addresses {
                  id
                  firstName
                  lastName
                  address1
                  city
                  province
                  country
                  zip
                  phone
                  name
                  provinceCode
                  countryCodeV2
                }
              }
            }
          }
        }
      `,
      {
        variables: {
          query: `email:${email}`,
        },
      }
    );

    const customers = response?.data?.customers?.edges?.map(e => e.node) || [];

    if (!customers.length) {
      console.log("⚠️ No customer found with email:", email);
      return null;
    }

    // ✅ Prefer NON-blacklisted email
    const realCustomer = customers.find(
      c => !c.email.startsWith("blacklisted-")
    );
    if (realCustomer) {
      console.log("✅ Real Customer found:", realCustomer.email);
    } else {
      console.log("⚠️ No real customer found. Using first customer:", customers[0]?.email);
    }

    return realCustomer || customers[0];

  } catch (error) {
    console.error("❌ Failed to fetch customer by email:", error);
    throw error;
  }
};

const createCustomer = async (input) => {
  try {
    const client = GetGrapqlClient({ scopes: ["write_customers"] });

    const response = await client.request(
      `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          userErrors {
            field
            message
          }
          customer {
            id
            email
            phone
            firstName
            lastName
            taxExempt
            amountSpent {
              amount
              currencyCode
            }
            smsMarketingConsent {
              marketingState
              marketingOptInLevel
              consentUpdatedAt
            }
            addresses {
              address1
              address2
              city
              zip
              countryCode
              phone
            }
          }
        }
      }
    `,
      {
        variables: { input },
      }
    );

    const { userErrors, customer } = response?.data?.customerCreate || {};

    if (userErrors && userErrors.length > 0) {
      console.error("⚠️ Shopify user errors:", JSON.stringify(userErrors, null, 2));
      return { success: false, errors: userErrors };
    }

    console.log("✅ Customer created successfully:", customer);
    return { success: true, customer };

  } catch (error) {
    console.error("❌ Shopify mutation failed:", JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }
};

const updateCustomerMetafield = async (input) => {
  try {
    const client = GetGrapqlClient({ scopes: ["write_customers"] });

    const response = await client.request(
      `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: input
      }
    );

    const result = response?.data?.metafieldsSet;

    if (result?.userErrors?.length) {
      console.error("❌ Metafield update errors:", result.userErrors);
      return { success: false, errors: result.userErrors };
    }

    return { success: true, metafield: result.metafields[0] };

  } catch (error) {
    console.error("❌ Metafield update failed:", error.message);
    return { success: false, error: error.message };
  }
};


export {
  createCustomer,
  getCustomerByEmail,
  updateCustomerMetafield
};