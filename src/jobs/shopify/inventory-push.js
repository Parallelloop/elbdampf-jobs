import DB from "../../database";
// import { Op } from "sequelize";
// import { ceil } from "lodash";
// import moment from "moment";
import GetClient from "../../services/sp-api/client";
import { createFeedDocument, createFeed, uploadFeedDocument } from "../../services/sp-api/feeds";
// import { createFeedDocument, createFeed, uploadFeedDocument } from "../services/amazon/feeds";
// import { mapItemsFeed } from '../utils/generators';
import { fetchActiveProducts } from "../../services/shopify/product";
import Agenda from "../../config/agenda-jobs";
import { EMAILS, JOB_STATES } from "../../utils/constants";
import { sendEmail } from "../../utils/send-email";


const flattenProductsWithVariants = (products) => {
  return products.flatMap(product => {
    return product.variants.edges.map(({ node }) => ({
      productId: product.id,
      variantId: node.id,
      title: product.title,
      status: product.status,
      sku: node.sku,
      price: Number(node.price),
      inventoryQuantity: node.inventoryQuantity
    }));
  });
}

const mapItemsFeed =  async ({
  sellerId,
  marketplaceId,
  items
}) => {
  const messages = [];
  const skus = items
    .map(item => item.sku)
    .filter(Boolean);

  const products = await DB.products.findAll({
    where: { sku: skus },
    attributes: ["sku", "productType"],
  });

  const productTypeMap = {};

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    productTypeMap[product.sku] = product.productType;
  }

  for (let i = 0; i < items.length; i++) {
    const {
      sku,
      inventoryQuantity,
    } = items[i];
    const productType = productTypeMap[sku] || "";
    if(!sku || !productType) continue;

    const item = {
      messageId: i + 1,
      sku,
      operationType: "PATCH",
      productType,
      patches: [
        {
          op: "replace",
          path: "/attributes/fulfillment_availability",
          value: [
              {
                fulfillment_channel_code: "DEFAULT",
                quantity: inventoryQuantity,
            }
          ]
        }
      ]
    };
    messages.push(item);
  }
  const feed = {
    header: {
      sellerId: sellerId,
      version: "2.0",
      issueLocale: "en_US",
    },
    messages,
  };
  return feed;
};

Agenda.define("inventory-push", { concurrency: 1, lockLifetime: 60 * 60000 }, async (job, done) => {
  console.log('*********************************************************');
  console.log('*****************   Push Amazon Inventory    *******************');
  console.log('*********************************************************');
  let { feedId } = job.attrs.data;

  try {
    const activeProducts = await fetchActiveProducts();
    console.log("🚀 ~ activeProducts[i]:", JSON.stringify(activeProducts, null, 4));
    if(activeProducts.length) {
      const flattenedProducts = flattenProductsWithVariants(activeProducts);
      console.log("🚀 ~ flattenedProducts:", JSON.stringify(flattenedProducts, null, 4));
      const feed = await mapItemsFeed({ sellerId:  "A2XZLZDZR4H3UG", marketplaceId: "A1PA6795UKMFR9", items: flattenedProducts });
      console.log("🚀 ~ feed:", JSON.stringify(feed, null, 4))
      if(process.env.NODE_ENV === "production") {
        const client = GetClient();
        const feedDetails = await createFeedDocument({ client, contentType: "application/json; charset=UTF-8" });
        console.log("🚀 ~ feedDetails:", feedDetails)
        await uploadFeedDocument({ client, feedDetails, feed: { content: JSON.stringify(feed), contentType: "application/json; charset=UTF-8" } });
        const { feedId } = await createFeed({ client, feedType: "JSON_LISTINGS_FEED", feedDocumentId: feedDetails.feedDocumentId, marketplaceId:  "A1PA6795UKMFR9" });
        console.log("🚀 ~ feedId ~ ", feedId);
        job.attrs.data.lastUpdatedAfter = feedId;
      }
    }
    job.attrs.state = JOB_STATES.COMPLETED;
    job.attrs.lockedAt = null;
    job.attrs.progress = 100;
    await job.save();

    console.log('*****************************************************************');
    console.log('******************     Push Amazon Inventory COMPLETED   *****************');
    console.log('*****************************************************************');
    console.log('*****************************************************************');
  } catch (error) {
    console.log("🚀 ~ inventory-push.js ~ error", error)
    await sendEmail(EMAILS , "Urgent Jobs are Failing",  `Inventory Sync Job is failing, error: ${error.message}`);
    console.log('*****************************************************************');
    console.log('********************    Push Amazon Inventory RETRY   *******************');
    console.log('*****************************************************************');
    console.log('*****************************************************************');

    job.attrs.state = JOB_STATES.FAILED;
    job.attrs.failedAt = new Date();
    job.attrs.failReason = error.message;
    job.attrs.lockedAt = null;
    await job.save();
  }
  done();
});




