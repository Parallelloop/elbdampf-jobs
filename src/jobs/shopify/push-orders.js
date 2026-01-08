import moment from "moment";
import Agenda from "../../config/agenda-jobs";
import DB from "../../database";
import Orders from "../../database/models/orders";
import { sleep } from "../../helper/helper";
import { createCustomer, getCustomerByEmail } from "../../services/shopify/customer";
import { checkShopifyOrder, createShopifyOrder } from "../../services/shopify/order";
import { findVariantProduct } from "../../services/shopify/product";
import { fetchAmazonFBMOrders, fetchAmazonFBMOrdersPage, fetchAmazonOrderItems } from "../../services/sp-api/orders/order";
import { JOB_STATES } from "../../utils/constants";
import { clean, mapDeliveryMethodToShopify, pickHigherPriority } from "../../utils/generators";


Agenda.define("push-orders-shopify", { concurrency: 1, lockLifetime: 30 * 60000 }, async (job, done) => {
  console.log("*********************************************************");
  console.log("*****************   Push Orders Shopify Job    *******************");
  console.log("*********************************************************");
  try {

    let lastUpdatedAfter = job.attrs.data?.lastUpdatedAfter;
    if(lastUpdatedAfter){
      lastUpdatedAfter = moment(lastUpdatedAfter).subtract(15, 'minutes').toISOString();
    } else {
      lastUpdatedAfter = moment().subtract(1, 'day').toISOString();
    }
    const currentTime = new Date();

    console.log("🚀 ~ lastUpdatedAfter:", lastUpdatedAfter)
    let nextToken = null;
    let pageCount = 0;
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
        const firstName = fullName.split(" ")[0] || "";
        const lastName = fullName.split(" ").slice(1).join(" ") || "";
        const isResidentialAddress = shipping?.AddressType === "Residential";

        const address = {
          address1: isResidentialAddress ? clean(shipping?.AddressLine1) || "" : clean(shipping?.AddressLine2) || "",
          address2: isResidentialAddress ? clean(shipping?.AddressLine2) || "" : "",
          company: isResidentialAddress ? "" : clean(shipping?.AddressLine1) || "",
          city: clean(shipping?.City) || clean(addressFrom?.City) || "",
          countryCode: clean(shipping?.CountryCode) || clean(addressFrom?.CountryCode) || "DE",
          zip: clean(shipping?.PostalCode) || clean(addressFrom?.PostalCode) || "",
          phone: clean(shipping?.Phone) || clean(amazonOrder?.BuyerInfo?.BuyerPhone) || "",
        };
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
          deliveryMethodTag = tagFromProduct;
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

        const shippingLines = finalTag
          ? [
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
          ]
          : [];
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
        }
        const shippingAddressForOrder = address ? { firstName, lastName, ...address } : null;

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

          continue; // DO NOT touch order.id
        }

        if (!createOrderResp?.order?.id) {
          console.warn(`⚠️ Shopify order response missing order ID for Amazon ${orderId}`);
          continue;
        }

        console.log(`✅ Created Shopify order for Amazon order ${orderId}: ${createOrderResp?.order?.id}`);
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

    console.log("✅ All pages processed successfully.");

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





