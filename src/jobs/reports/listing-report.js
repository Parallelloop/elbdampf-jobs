import moment from "moment";
import Agenda from "../../config/agenda-jobs";
import AmazonClient from "../../services/sp-api/client";
import DB from "../../database";
import { JOB_STATES } from "../../utils/constants";
import { downloadDocument, getReport, getReportDocument, getReportId } from "../../services/sp-api";
import { parseTSV } from "../../utils/parse";
import getListingsItem from "../../services/sp-api/listings/get-listings-item";
import { normalizeListingItem } from "../../utils/generators";

const bulkSaveSequelize = async (data) => {
    try {
        if (!data || !data.length) return;

        const productBulk = [];
        const skuToInventory = new Map();

        for (const item of data) {
            productBulk.push({
                sku: item.sku,
                asin: item.asin,
                title: item.title,
                image: item.image,
                status: item.status,
                productType: item.productType,
                shippingMethod: item.shippingMethod,
            });
            skuToInventory.set(item.sku, item.inventory);
        }

        await DB.products.bulkCreate(productBulk, {
            updateOnDuplicate: ["productType", "asin", "title", "image", "status", "shippingMethod", "updatedAt"],
        });

        const products = await DB.products.findAll({
            where: { sku: Array.from(skuToInventory.keys()) },
            attributes: ["id", "sku"],
        });

        const inventoryBulk = products.map(p => ({
            productId: p.id,
            amazonQty: skuToInventory.get(p.sku),
        }));

        await DB.inventories.bulkCreate(inventoryBulk, {
            updateOnDuplicate: ["amazonQty", "updatedAt"],
        });
        console.log("🔥 Sequelize Bulk Upsert Completed");
    } catch (err) {
        console.error("❌ Sequelize Bulk Upsert Error:", err);
        throw err;
    }
};


Agenda.define("listing-report", { concurrency: 1, lockLifetime: 60 * 60000 }, async (job, done) => {
    console.log("*********************************************************");
    console.log("*****************   Fetch Listing Report    *******************");
    console.log("*********************************************************");
    let { reportId } = job.attrs.data;
    try {
        const client = AmazonClient();
        if (!reportId) {
            const listingReportId = await getReportId({ client, reportType: "GET_MERCHANT_LISTINGS_ALL_DATA" });
            reportId = listingReportId;
            job.attrs.data.reportId = listingReportId;
            job.attrs.nextRunAt = moment().add(60 * 5, "seconds").toDate();
            await job.save();
        } else {
            const { status, reportDocumentId } = await getReport({ client, reportId });
            console.log("🚀 ~ status:", status)
            if (["PENDING", "IN_PROGRESS", "PROCESSING"].includes(status)) {
                job.attrs.nextRunAt = moment().add(60 * 5, "seconds").toDate();
            } else {
                const reportData = await getReportDocument({ client, reportDocumentId });
                if (reportData.url) {
                    const report = await downloadDocument({ client, reportData });
                    if (report) {
                        const reportJson = await parseTSV(report);
                        console.log("🚀 ~ reportJson:", reportJson.length)
                        // console.log("🚀 ~ reportJson:", JSON.stringify(reportJson, null, 2));
                        const existingProducts = await DB.products.findAll({
                            where: {
                                sku: reportJson.map(item => item.handlerSku || item.sellerSku || item.SKU)
                            },
                            attributes: ["sku"],
                        });

                        const existingSkus = new Set(existingProducts.map(p => p.sku));
                        console.log("🚀 ~ existingSkus:", existingSkus)

                        const data = [];
                        for (let rawItem of reportJson) {
                            console.log("🚀 ~ item:", JSON.stringify(rawItem, null, 2));
                            const { sku, status, title, asin, fulfillmentChannel, quantity } = normalizeListingItem(rawItem);
                            // if (existingSkus.has(sku)) continue;
                            console.log("🚀 ~ sku:", sku)
                            const fulfillmentType = fulfillmentChannel === "DEFAULT" ? "FBM" : "FBA";
                            // const fulfillmentType = (fulfillmentChannel) => {
                            //     if (fulfillmentChannel === "DEFAULT") return "FBM"; // merchant fulfillment
                            //     if (fulfillmentChannel === "AMAZON_EU" || fulfillmentChannel === "AMAZON_FBA" || fulfillmentChannel === "AFN") return "FBA";
                            //     return "FBM"; // everything else shipped by merchant
                            // };


                            const listingInfo = await getListingsItem({ client, sku });
                            // console.log("🚀 ~ listingInfo:", JSON.stringify(listingInfo, null, 2));
                            let image = "";
                            const summary = listingInfo.summaries?.[0] || {};
                            const productType = summary.productType || "";
                            image = summary.mainImage?.link || "";

                            data.push({
                                status,
                                image,
                                title,
                                sku,
                                asin,
                                inventory: quantity,
                                shippingMethod: fulfillmentType,
                                productType,
                            });
                        }
                        await bulkSaveSequelize(data);
                        job.attrs.data.reportId = null;
                        await job.save();
                    } else {
                        console.log("🚀 ~ Error => Download Report Document");
                    }
                } else {
                    console.log("🚀 ~ Error => Get Report Document");
                }
            }
        }

        job.attrs.state = JOB_STATES.COMPLETED;
        job.attrs.lockedAt = null;
        job.attrs.progress = 100;
        await job.save();

        console.log("*****************************************************************");
        console.log("******************     Fetch Listing Report COMPLETED   *****************");
        console.log("*****************************************************************");
        console.log(`reportId: ${reportId}`);
        console.log("*****************************************************************");
    } catch (error) {
        console.log("*****************************************************************");
        console.log("********************    Fetch Listing Report RETRY   *******************");
        console.log("*****************************************************************");
        console.log("🚀 ~ listing-report ~ error", error);
        console.log(`reportId: ${reportId}`);
        console.log("*****************************************************************");

        job.attrs.state = JOB_STATES.FAILED;
        job.attrs.failedAt = new Date();
        job.attrs.failReason = error.message;
        job.attrs.lockedAt = null;
        await job.save();
    }
    done();
});




