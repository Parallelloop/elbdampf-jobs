import GetGrapqlClient from "./graphql-client";

const getCustomerByEmail = async (email) => {
  try {
    const client = GetGrapqlClient({ scopes: ["read_customers"] });

    const response = await client.request(
      `
        query GetCustomerByEmail($query: String!) {
          customers(first: 10, query: $query) {
            edges {
              node {
                id
                email
                firstName
                lastName
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
   
    const customer = response?.data?.customers?.edges?.[0]?.node || null;

    if (customer) {
      console.log("✅ Customer found:", customer.email);
    } else {
      console.log("⚠️ No customer found with email:", email);
    }

    return customer;
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



export {
  createCustomer,
  getCustomerByEmail
};