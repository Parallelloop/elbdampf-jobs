import DB from "../../database";
// import { Op } from "sequelize";
// import { ceil } from "lodash";
// import moment from "moment";
// import { GetClient } from "../services/amazon";
// import { createFeedDocument, createFeed, uploadFeedDocument } from "../services/amazon/feeds";
// import { mapItemsFeed } from '../utils/generators';
import { fetchActiveProducts } from "../../services/shopify/product";
import Agenda from "../../config/agenda-jobs";
import { JOB_STATES } from "../../utils/constants";

const GetExchangeRate = async (currencyCode) => {
  const rate = await DB.exchangeRates.findOne({ where: { currencyCode } });
  if(rate) {
    return rate.rate;
  } else {
    return false;
  }
}

Agenda.define("inventory-push", { concurrency: 1, lockLifetime: 60 * 60000 }, async (job, done) => {
  console.log('*********************************************************');
  console.log('*****************   Push Amazon Inventory    *******************');
  console.log('*********************************************************');
  let { userId, storeId, feedId } = job.attrs.data;

  try {
    const activeProducts = await fetchActiveProducts();
      if(activeProducts.length) {
        for(let i = 0; i < activeProducts.length; i++) {
          const { marketplaceId, shippingFee, currencyCode, vatTaxPercentage, isActive } = activeProducts[i];
          console.log("🚀 ~ activeProducts[i]:", JSON.stringify(activeProducts[i], null, 4));
          // const rate = await GetExchangeRate(currencyCode);
          // const rate = await GetExchangeRate(currencyCode);
          // if(rate && vatTaxPercentage > 0) {
          //   const { feed, itemIds } = mapItemsFeed({ sellerId, currency: currencyCode, rate, marketplaceId, vat: vatTaxPercentage, shipping: shippingFee, isActive, allItems: items });
          //   if(process.env.NODE_ENV === "production") {
          //     const client = GetClient({ refresh_token: refreshToken, region });
          //     const feedDetails = await createFeedDocument({ client, contentType: "application/json; charset=UTF-8" });
          //     await uploadFeedDocument({ client, feedDetails, feed: { content: JSON.stringify(feed), contentType: "application/json; charset=UTF-8" } });
          //     const { feedId } = await createFeed({ client, feedType: "JSON_LISTINGS_FEED", feedDocumentId: feedDetails.feedDocumentId, marketplaceId });
          //     console.log("🚀 ~ feedId ~ ", feedId);
          //     if(itemIds.length) await DB.itemMarketplaceStatus.update({ status: "ACTIVE" }, { where: { itemId: { [Op.in]: itemIds }, marketplaceId } });
          //   }
          // } else {
          //   console.log("Missing Conversion Rate");
          // }
          await job.touch();
        }
      }
    job.attrs.state = JOB_STATES.COMPLETED;
    job.attrs.lockedAt = null;
    job.attrs.progress = 100;
    await job.save();

    console.log('*****************************************************************');
    console.log('******************     Push Amazon Inventory COMPLETED   *****************');
    console.log('*****************************************************************');
    // console.log(`userId: ${userId}`);
    console.log('*****************************************************************');
  } catch (error) {
    console.log("🚀 ~ inventory-push.js ~ error", error)
    console.log('*****************************************************************');
    console.log('********************    Push Amazon Inventory RETRY   *******************');
    console.log('*****************************************************************');
    // console.log(`userId: ${userId}`);
    console.log('*****************************************************************');

    job.attrs.state = JOB_STATES.FAILED;
    job.attrs.failedAt = new Date();
    job.attrs.failReason = error.message;
    job.attrs.lockedAt = null;
    await job.save();
  }
  done();
});




