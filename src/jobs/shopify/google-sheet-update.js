import Agenda from "../../config/agenda-jobs";
import DB from "../../database";
import { appendCustomersToSheet } from "../../services/google-apis/client-google-sheet";
import { getAllCustomers } from "../../services/shopify/customer";
import { getShopifyTodayOrdersCount } from "../../services/shopify/order";
import { JOB_STATES } from "../../utils/constants";
import { sendEmail } from "../../utils/send-email";

Agenda.define("google-sheet-update", { concurrency: 1, lockLifetime: 30 * 60000 }, async (job, done) => {
  console.log("*********************************************************");
  console.log("*****************   Google Sheet Update Job STARTED    *******************");
  console.log("*********************************************************");
  try {
    const { coilsCount, total, success } = await getShopifyTodayOrdersCount();
    if (success) {
      await appendCustomersToSheet(coilsCount);
      console.log(`✅ Found ${total} orders today, including ${coilsCount} coils.`);
    } else {
      console.log("❌ Failed to retrieve orders");
    }

    console.log("✅ All pages processed successfully.");
    job.attrs.state = JOB_STATES.COMPLETED;
    job.attrs.lockedAt = null;
    job.attrs.progress = 100;
    await job.save();

    console.log("*****************************************************************");
    console.log("******************   Google Sheet Update Job COMPLETED   *****************");
    console.log("*****************************************************************");
    console.log("*****************************************************************");
  } catch (error) {
    const setting = await DB.settings.findOne({ where: { id: 1 } });
    if (!setting) {
      console.log("⚠️ No settings found");
    }
    if (setting?.emailOnErrors) {
      await sendEmail(setting.errorEmails, "Urgent Jobs are Failing", `Shopify Google Sheet Update Job is failing, error: ${error.message}`);
    }
    console.log("*****************************************************************");
    console.log("********************   Google Sheet Update Job RETRY   *******************");
    console.log("*****************************************************************");
    console.log("error in google sheet update job", error.message);
    console.log("*****************************************************************");

    job.attrs.state = JOB_STATES.FAILED;
    job.attrs.failedAt = new Date();
    job.attrs.failReason = error.message;
    job.attrs.lockedAt = null;
    await job.save();
  }
  done();
});





