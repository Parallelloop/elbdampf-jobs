import Agenda from "../../config/agenda-jobs";
import DB from "../../database";
import { mapAmazonToShopifyOrders } from "../../helper/helper";
import { createCustomer, getCustomerByEmail } from "../../services/shopify/customer";
import GetGrapqlClient from "../../services/shopify/graphql-client";
import { checkShopifyOrder, createShopifyOrder } from "../../services/shopify/order";
import { findVariantProduct } from "../../services/shopify/product";
import { fetchAmazonFBMOrders, fetchAmazonOrderItems } from "../../services/sp-api/order";
import { JOB_STATES } from "../../utils/constants";
import { clean } from "../../utils/generators";

Agenda.define("push-orders-shopify", { concurrency: 15, lockLifetime: 30 * 60000 }, async (job, done) => {
  console.log("*********************************************************");
  console.log("*****************   Push Orders Shofiy Job    *******************");
  console.log("*********************************************************");
  try {
    // const users = await DB.users.findAll({});
    const lastUpdatedAfter = job.attrs.data?.lastUpdatedAfter || "2025-10-01T12:10:02";
    const amazonOrders = await fetchAmazonFBMOrders(lastUpdatedAfter);
    const ordersList = amazonOrders?.Orders || [];

    console.log(`🚀 Fetched ${ordersList.length} Amazon orders`);
    if (!ordersList.length) {
      console.log("No new Amazon orders to process.");
    }
    console.log("🚀 ~ file: some-job.js:15 ~ Agenda.define ~ amazonOrders:", JSON.stringify(ordersList, null, 2));

    for (const amazonOrder of ordersList) {
      console.log("Processing Amazon order:", amazonOrder.AmazonOrderId);
      const orderId = amazonOrder.AmazonOrderId;
      const amazonItemsResp = await fetchAmazonOrderItems(orderId);
      const amazonOrderItems = amazonItemsResp?.OrderItems || [];
      const buyerEmail = amazonOrder?.BuyerInfo?.BuyerEmail || null;
      const shopifyLineItems = [];

      if (!buyerEmail) {
        console.log(`⚠️ Skipping order ${amazonOrder.AmazonOrderId} — no buyer email`);
        continue;
      }

      const shipping = amazonOrder?.ShippingAddress || {};
      const addressFrom = amazonOrder?.DefaultShipFromLocationAddress || {};
      const fullName = clean(shipping?.Name) || "";
      const firstName = fullName.split(" ")[0] || "";
      const lastName = fullName.split(" ").slice(1).join(" ") || "";
      const address = {
        address1: clean(shipping?.AddressLine1) || "",
        address2: clean(shipping?.AddressLine2) || "",
        city: clean(shipping?.City) || clean(addressFrom?.City) || "",
        countryCode: clean(shipping?.CountryCode) || clean(addressFrom?.CountryCode) || "DE",
        zip: clean(shipping?.PostalCode) || clean(addressFrom?.PostalCode) || "",
        phone: clean(shipping?.Phone) || clean(amazonOrder?.BuyerInfo?.BuyerPhone) || "",
      };
      // console.log("🚀 ~ amazonOrderItems:", JSON.stringify(amazonOrderItems, null, 2));

      for (const item of amazonOrderItems) {
        const sku = item.SellerSKU;
        const qty = item.QuantityOrdered || 1;
        const variantResult = await findVariantProduct({ query: sku });
        if (!variantResult.success || variantResult.variants.length === 0) {
          console.warn(`No variant found for SKU: ${sku}`);
          continue;
        }
        const variant = variantResult.variants[0];

        shopifyLineItems.push({
          variantId: variant.id,
          variantTitle: variant.title || "Variant Item",
          quantity: qty,
          title: item.Title || "Product Item",
          priceSet: {
            shopMoney: {
              amount: item.ItemPrice?.Amount || variant?.price,
              currencyCode: item.ItemPrice?.CurrencyCode || "EUR"
            }
          },
          sku: sku,
          taxLines: item.ItemTax
            ? [
              {
                title: "VAT",
                rate: parseFloat(item?.ItemTax?.Amount) / parseFloat(item?.ItemPrice?.Amount),
                priceSet: {
                  shopMoney: {
                    amount: item?.ItemTax?.Amount,
                    currencyCode: item?.ItemTax?.CurrencyCode
                  }
                }
              }
            ]
            : []
        });

        if (shopifyLineItems.length === 0) {
          console.log(`⚠️ No mapped line items for Amazon order ${orderId}`);
          continue;
        }
      }

      let shopifyCustomer = await getCustomerByEmail(buyerEmail);

      if (!shopifyCustomer) {
        const newCustomerPayload = {
          email: buyerEmail,
          phone: shipping?.Phone || amazonOrder?.BuyerInfo?.BuyerPhone || null,
          firstName: amazonOrder?.BuyerInfo?.BuyerName?.split(" ")[0] || "Amazon",
          lastName: amazonOrder?.BuyerInfo?.BuyerName?.split(" ")[1] || "Customer",
          addresses: [address],
          taxExempt: false,
          ...(amazonOrder?.BuyerInfo?.BuyerPhone
            ? {
              smsMarketingConsent: {
                marketingState: "NOT_SUBSCRIBED",
                marketingOptInLevel: "SINGLE_OPT_IN",
              },
            }
            : {}),
        };

        shopifyCustomer = await createCustomer(newCustomerPayload);
        if (shopifyCustomer?.success) {
          shopifyCustomer = shopifyCustomer.customer;
          console.log(`✅ Created new Shopify customer: ${shopifyCustomer?.id} (${buyerEmail})`);
        } else {
          console.error("❌ Failed to create Shopify customer", shopifyCustomer?.errors, ` for Amazon order ${orderId}`);
        }

      } else {
        if (Array.isArray(shopifyCustomer?.edges)) {
          shopifyCustomer = shopifyCustomer?.edges[0]?.node;
        }
        console.log(`ℹ️ Existing Shopify customer: ${shopifyCustomer?.id} (${buyerEmail})`);
      }

      const customerId = shopifyCustomer?.id;
      const shippingAddressForOrder = address ? { firstName, lastName, ...address } : null;

      const createOrderResp = await createShopifyOrder({
        customerId,
        lineItems: shopifyLineItems,
        shippingAddress: shippingAddressForOrder,
        amazonOrderId: orderId,
      });

      if (!createOrderResp.success) {
        console.error("❌ Failed to create Shopify order for Amazon order", orderId, createOrderResp);
        return { success: false, error: createOrderResp.error || createOrderResp.errors, orderId };
      }

      console.log(`✅ Created Shopify order for Amazon order ${orderId}: ${createOrderResp.order.id}`);
    }

    job.attrs.state = JOB_STATES.COMPLETED;
    job.attrs.lockedAt = null;
    job.attrs.progress = 100;
    await job.save();

    console.log("*****************************************************************");
    console.log("******************   Push Orders Shopify Job COMPLETED   *****************");
    console.log("*****************************************************************");
    console.log("*****************************************************************");
  } catch (error) {
    console.log("*****************************************************************");
    console.log("********************   Push Orders Shopify Job RETRY   *******************");
    console.log("*****************************************************************");
    console.log("error in push orders shopify job", error.message);
    console.log("*****************************************************************");

    job.attrs.state = JOB_STATES.FAILED;
    job.attrs.failedAt = new Date();
    job.attrs.failReason = error.message;
    job.attrs.lockedAt = null;
    await job.save();
  }
  done();
});





