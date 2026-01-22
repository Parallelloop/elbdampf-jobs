import moment from "moment";
import Agenda from "../../config/agenda-jobs";
import DB from "../../database";
import { getMostUsedDeliveryMethod, sleep } from "../../helper/helper";
import { createCustomer, getCustomerByEmail, updateCustomerMetafield } from "../../services/shopify/customer";
import { checkShopifyOrder, createShopifyOrder, getShopifyOrdersByCustomerEmail, shopifyOrderMarkAsPaid } from "../../services/shopify/order";
import { findVariantProduct } from "../../services/shopify/product";
import { fetchAmazonFBMOrdersPage, fetchAmazonOrderItems } from "../../services/sp-api/orders/order";
import { JOB_STATES } from "../../utils/constants";
import { clean } from "../../utils/generators";
import { sendEmail } from "../../utils/send-email";
import fs from 'fs';
import path from 'path';
const csv = require('fast-csv');


Agenda.define("push-orders-shopify", { concurrency: 1, lockLifetime: 30 * 60000 }, async (job, done) => {
  console.log("*********************************************************");
  console.log("*****************   Push Orders Shopify Job    *******************");
  console.log("*********************************************************");
  try {
    const EmailsForCustomers = ["nabeelsajid917@gmail.com", "patrick@shiplogic.app"];
    let totalImportCount = 0;
    let lastUpdatedAfter = job.attrs.data?.lastUpdatedAfter;
    if (lastUpdatedAfter) {
      lastUpdatedAfter = moment(lastUpdatedAfter).subtract(15, 'minutes').toISOString();
    } else {
      lastUpdatedAfter = moment().subtract(1, 'day').toISOString();
    }
    const currentTime = new Date();

    console.log("🚀 ~ lastUpdatedAfter:", lastUpdatedAfter)
    let nextToken = null;
    let pageCount = 0;
    let customers = [];
    while (true) {
      const { amazonOrders, nextToken: newNextToken } = await fetchAmazonFBMOrdersPage({
        nextToken,
        lastUpdatedAfter,
      });

      if (!amazonOrders.length) {
        console.log("No new Amazon orders to process.");
      }
      // console.log("🚀 ~ file: some-job.js:15 ~ Agenda.define ~ amazonOrders:", JSON.stringify(ordersList, null, 2));
      pageCount++;
      console.log(`📦 Processing page #${pageCount} — Orders: ${amazonOrders.length}`);

      for (let i = 0; i < amazonOrders.length; i++) {
        const amazonOrder = amazonOrders[i];
        const shopifyLineItems = [];
        const buyerEmail = amazonOrder?.BuyerInfo?.BuyerEmail || null;
        const orderId = amazonOrder?.AmazonOrderId;
        const processedAt = amazonOrder?.PurchaseDate;
        const shipping = amazonOrder?.ShippingAddress || {};
        const addressFrom = amazonOrder?.DefaultShipFromLocationAddress || {};
        const fullName = clean(shipping?.Name) || "";
        const firstName = fullName.split(" ")[0] || "No Name";
        const lastName = fullName.split(" ").slice(1).join(" ") || fullName.split(" ")[0] || "No Name";
        const isResidentialAddress = shipping?.AddressType == "Residential" || false;
        console.log("🚀 ~ isResidentialAddress:", isResidentialAddress)

        const address = {
          address1: isResidentialAddress ? clean(shipping?.AddressLine1) || "" : clean(shipping?.AddressLine2) || clean(shipping?.AddressLine1) || "",
          address2: isResidentialAddress ? clean(shipping?.AddressLine2) || "" : "",
          company: isResidentialAddress ? "" : shipping?.AddressLine2 ? clean(shipping?.AddressLine1) || "" : "",
          city: clean(shipping?.City) || clean(addressFrom?.City) || "",
          countryCode: clean(shipping?.CountryCode) || clean(addressFrom?.CountryCode) || "DE",
          zip: clean(shipping?.PostalCode) || clean(addressFrom?.PostalCode) || "",
          phone: clean(shipping?.Phone) || clean(amazonOrder?.BuyerInfo?.BuyerPhone) || "",
        };
        console.log("🚀 ~ address:", address)
        console.log("Processing Amazon order:", orderId);

        // if(orderId !== "303-8543379-1405916") {
        //   continue;
        // }
        // console.log("🚀 ~ Found specific order:", amazonOrder);

        if (!buyerEmail) {
          console.log(`⚠️ Skipping order ${orderId} — no buyer email`);
          continue;
        }

        let dbOrder = await DB.orders.findOne({ where: { orderId: orderId } });
        if (dbOrder && dbOrder?.isPosted) {
          console.log(`⏩ Order ${orderId} already posted to Shopify. Skipping...`);
          continue;
        }

        if (!dbOrder) {
          dbOrder = await DB.orders.create({
            orderId: orderId,
            orderStatus: amazonOrder.OrderStatus,
            purchaseDate: amazonOrder.PurchaseDate,
            isPosted: false,
            buyerEmail: buyerEmail,
            buyerName: fullName,
            addressLine1: address?.address1 || "",
            addressLine2: address?.address2 || "",
            city: address?.city || "",
            stateOrRegion: shipping?.StateOrRegion || "",
            postalCode: address?.zip || "",
            countryCode: address?.countryCode || "",
            addressType: shipping?.AddressType || "",
            orderErrors: null,
          });
          console.log(`💾 Saved new Amazon order in DB: ${orderId}`);
        }

        const amazonItemsResp = await fetchAmazonOrderItems(orderId);
        const amazonOrderItems = amazonItemsResp?.OrderItems || [];
        let subtotal = 0;
        let taxTotal = 0;
        let deliveryMethodTag = null;
        let currentPriority = 0;
        let skipOrder = false;
        for (let j = 0; j < amazonOrderItems.length; j++) {
          const item = amazonOrderItems[j];

          const sku = item?.SellerSKU;
          const asin = item?.ASIN || null;
          console.log("🚀 ~ sku:", sku);
          console.log("🚀 ~ asin:", asin);
          const productRecord = await DB.products.findOne({
            where: { asin },
            include: [{ model: DB.deliveryMethod, as: "deliveryMethod" }]
          });

          const tagFromProduct = productRecord?.deliveryMethod?.tag || null;
          const priorityFromProduct = productRecord?.deliveryMethod?.priority || 0;

          if (!deliveryMethodTag || priorityFromProduct < currentPriority) {
            deliveryMethodTag = tagFromProduct;
            currentPriority = priorityFromProduct;
          }

          const qty = item?.QuantityOrdered || 1;

          const variantResult = await findVariantProduct({ query: sku });
          if (!variantResult.success || variantResult.variants.length === 0) {
            console.warn(`❌ SKU not found on Shopify. Skipping entire order ${orderId}. SKU: ${sku}`);
            skipOrder = true;
            break; // stop processing items
          }
          const totalItemPrice = parseFloat(item?.ItemPrice?.Amount || 0);
          const taxRate = 0.19;

          const taxAmount = totalItemPrice * (taxRate / (1 + taxRate));
          const netTotalPrice = totalItemPrice - taxAmount;

          const variant = variantResult.variants[0];
          const unitPrice = qty > 0 ? netTotalPrice / qty : 0;
          subtotal += netTotalPrice;
          taxTotal += taxAmount;

          shopifyLineItems.push({
            variantId: variant.id,
            variantTitle: item.Title || variant.title || "Variant Item",
            quantity: qty,
            title: item.Title || variant.title || "Product Item",
            requiresShipping: true,
            priceSet: {
              shopMoney: {
                amount: unitPrice.toFixed(2),
                currencyCode: item.ItemPrice?.CurrencyCode || "EUR"
              }
            },
            sku: sku,
            taxLines: [
              {
                title: "VAT",
                rate: taxRate,
                priceSet: {
                  shopMoney: {
                    amount: taxAmount.toFixed(2),
                    currencyCode: item?.ItemTax?.CurrencyCode || "EUR"
                  }
                }
              }
            ]
          });

          if (shopifyLineItems.length === 0) {
            console.log(`⚠️ No mapped line items for Amazon order ${orderId}`);
            continue;
          }
        }

        if (skipOrder) {
          await DB.orders.update(
            {
              orderErrors: "One or more products not found on Shopify",
            },
            { where: { orderId } }
          );

          console.log(`⏭️ Order ${orderId} skipped — product not available on Shopify`);
          continue; // move to next Amazon order
        }

        const finalTag = deliveryMethodTag || "standard";

        console.log("🚀 ~ finalTag:", finalTag)

        let shippingLines = [
          {
            title: finalTag,
            code: finalTag,
            priceSet: {
              shopMoney: {
                amount: "0.0",
                currencyCode: "EUR",
              },
            },
          },
        ];
        const totalAmount = subtotal + taxTotal;

        let shopifyCustomer = await getCustomerByEmail(buyerEmail);
        await sleep(5); // 5 seconds

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
          await sleep(5); // 5 seconds
          await job.touch();
        } else {
          if (Array.isArray(shopifyCustomer?.edges)) {
            shopifyCustomer = shopifyCustomer?.edges[0]?.node;
          }
          console.log(`ℹ️ Existing Shopify customer: ${shopifyCustomer?.id} (${buyerEmail})`);
          if (shopifyCustomer?.metafield?.value) {
            console.log("🚚 Customer delivery_method metafield found:", shopifyCustomer?.metafield?.value);
            shippingLines = [
              {
                title: shopifyCustomer?.metafield?.value,
                code: shopifyCustomer?.metafield?.value,
                priceSet: {
                  shopMoney: {
                    amount: "0.0",
                    currencyCode: "EUR",
                  },
                },
              },
            ];
          } else {
            let finalDeliveryMethod = null;
            console.log("⚠️ No customer delivery_method metafield found:");
            const customerOrdersResp = await getShopifyOrdersByCustomerEmail(buyerEmail);

            if (!customerOrdersResp?.success) {
              console.log("⚠️ Could not fetch customer orders");
            }

            const orders = customerOrdersResp?.orders || [];
            console.log("🚀 ~ orders:", JSON.stringify(orders, null, 2));

            if (orders.length >= 2) {
              // finalDeliveryMethod = getMostUsedDeliveryMethod(orders);
              finalDeliveryMethod = "coils";
              customers.push({
                firstName: shopifyCustomer?.firstName,
                lastName: shopifyCustomer?.lastName,
                email: shopifyCustomer?.email,
                deliveryMethod: finalDeliveryMethod,
              });
              shippingLines = [
                {
                  title: finalDeliveryMethod,
                  code: finalDeliveryMethod,
                  priceSet: {
                    shopMoney: {
                      amount: "0.0",
                      currencyCode: "EUR",
                    },
                  },
                },
              ];
              const setMetaFields = {
                metafields: [
                  {
                    ownerId: shopifyCustomer?.id,
                    namespace: "custom",
                    key: "delivery_method",
                    type: "single_line_text_field",
                    value: finalDeliveryMethod
                  }
                ]
              }
              const updateMetaFieldResponse = await updateCustomerMetafield(setMetaFields);
              if (!updateMetaFieldResponse?.success) {
                console.log("⚠️ Could not update customer metafield");
              }
            }
            console.log("🚚 Final delivery method:", finalDeliveryMethod);
          }
        }
        const shippingAddressForOrder = address ? { firstName, lastName, ...address } : null;
        console.log("🚀 ~ shippingAddressForOrder:", shippingAddressForOrder)

        // 🔍 Check if Shopify order already exists for this Amazon Order
        const existingOrderCheck = await checkShopifyOrder(orderId, buyerEmail);

        if (existingOrderCheck?.success && existingOrderCheck?.edges?.length > 0) {
          console.log(`⏩ Shopify order already exists for Amazon order ${orderId}. Skipping import.`);

          await DB.orders.update(
            { isPosted: true, orderErrors: null },
            { where: { orderId } }
          );

          continue;
        }

        const createOrderResp = await createShopifyOrder({
          customerId: shopifyCustomer?.id,
          buyerEmail,
          totalAmount,
          processedAt,
          lineItems: shopifyLineItems,
          shippingLines,
          shippingAddress: shippingAddressForOrder,
          amazonOrderId: orderId,
        });

        await sleep(5); // 5 seconds
        await job.touch();

        const setting = await DB.settings.findOne({ where: { id: 1 } });
        if (!setting) {
          console.warn(`⚠️ No settings found Email is not sending ${orderId}`);
        }

        if (
          !createOrderResp?.success ||
          createOrderResp?.errors?.length
        ) {
          const errorMessage =
            createOrderResp?.errors
              ?.map(e => e.message)
              .join(", ") ||
            createOrderResp?.error ||
            "Unknown Shopify error";

          await DB.orders.update(
            { orderErrors: errorMessage },
            { where: { orderId } }
          );

          console.error(
            `❌ Shopify order failed for Amazon ${orderId}:`,
            errorMessage
          );

          if (setting?.emailOnErrors) {
            sendEmail(setting.errorEmails, "Shopify Order Creation Failed", `Amazon Order ${orderId}, Shopify Order creation failed with error ${errorMessage}`);
          }

          continue; // DO NOT touch order.id
        }

        if (!createOrderResp?.order?.id) {
          console.warn(`⚠️ Shopify order response missing order ID for Amazon ${orderId}`);
          continue;
        }

        const shopifyOrderId = createOrderResp?.order?.id;

        await sleep(2);
        await job.touch();

        // 💰 Mark order as paid
        const markPaidResp = await shopifyOrderMarkAsPaid(shopifyOrderId);

        if (!markPaidResp?.success) {
          const paymentError =
            markPaidResp?.errors
              ?.map(e => e.message)
              .join(", ") ||
            markPaidResp?.error ||
            "Failed to mark order as paid";

          await DB.orders.update(
            { orderErrors: paymentError },
            { where: { orderId } }
          );

          console.error(
            `❌ Failed to mark Shopify order as paid for Amazon ${orderId}:`,
            paymentError
          );

          if (setting?.emailOnErrors) {
            sendEmail(setting.errorEmails, "Shopify Order Mark Paid Failed", `Amazon Order ${orderId}, Shopify Order Mark as Paid failed with error ${paymentError}`);
          }

          continue;
        }

        console.log(`✅ Created Shopify order for Amazon order ${orderId}: ${createOrderResp?.order?.id}`);
        totalImportCount++;
        if (!address.address1 && setting?.emailOnErrors) {
          sendEmail(setting.errorEmails, "Shopify Missing Address", `Amazon Order ${orderId}, Shopify Order Id: ${createOrderResp?.order?.id} is missing address information.`);
        }
        await DB.orders.update(
          { isPosted: true, orderErrors: null },
          { where: { orderId: orderId } }
        );
        console.log(`🔄 Updated order ${orderId} → isPosted = true`);
      }

      job.attrs.data.lastUpdatedAfter = currentTime;
      await job.save();

      if (!newNextToken) break;
      nextToken = newNextToken;
      await job.touch();

      await sleep(5); // 5 seconds between page
    }

    // if (customers.length > 0) {
    //   console.log(`✅ Found ${customers.length} customers to process.`);

    //   const outputPath = path.resolve(process.cwd(), "customers.csv");
    //   const ws = fs.createWriteStream(outputPath);
    //   const csvStream = csv.format({
    //     headers: [
    //       "firstName",
    //       "lastName",
    //       "email",
    //       "deliveryMethod",
    //     ]
    //   });

    //   csvStream
    //     .pipe(ws)
    //     .on("finish", async () => {
    //       console.log("✅ CSV created at:", outputPath);

    //       try {
    //         await sendEmail(
    //           EmailsForCustomers,
    //           "Shopify Customers Delivery Methods",
    //           "Attached is the customers CSV.",
    //           [{ filename: "customers.csv", path: outputPath }]
    //         );

    //         console.log("📨 Email sent with CSV attachment");
    //       } catch (emailError) {
    //         console.error("❌ Failed to send email:", emailError);
    //       } finally {
    //         fs.unlink(outputPath, (err) => {
    //           if (err) {
    //             console.error("❌ Failed to delete CSV:", err);
    //           } else {
    //             console.log("🗑️ CSV file deleted successfully");
    //           }
    //         });
    //       }
    //     })
    //     .on("error", console.error);

    //   // ✍️ Write all customers
    //   for (let i = 0; i < customers.length; i++) {
    //     csvStream.write(customers[i]);
    //   }
    //   csvStream.end();
    // }

    console.log("✅ All pages processed successfully.");
    console.log(`📊 Total Amazon Orders Imported: ${totalImportCount}`);
    job.attrs.data.totalImportCount = totalImportCount;
    job.attrs.state = JOB_STATES.COMPLETED;
    job.attrs.lockedAt = null;
    job.attrs.progress = 100;
    await job.save();

    console.log("*****************************************************************");
    console.log("******************   Push Orders Shopify Job COMPLETED   *****************");
    console.log("*****************************************************************");
    console.log("*****************************************************************");
  } catch (error) {
    const setting = await DB.settings.findOne({ where: { id: 1 } });
    if (!setting) {
      console.log("⚠️ No settings found");
    }
    if (setting?.emailOnErrors) {
      await sendEmail(setting.errorEmails, "Urgent Jobs are Failing", `Shopify Push Orders Sync Job is failing, error: ${error.message}`);
    }
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





