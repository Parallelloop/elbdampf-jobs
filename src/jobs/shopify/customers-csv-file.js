import Agenda from "../../config/agenda-jobs";
import DB from "../../database";
import { getAllCustomers } from "../../services/shopify/customer";
import { JOB_STATES } from "../../utils/constants";
import { sendEmail } from "../../utils/send-email";
import fs from 'fs';
import path from 'path';
const csv = require('fast-csv');

Agenda.define("customers-csv-file", { concurrency: 1, lockLifetime: 30 * 60000 }, async (job, done) => {
  console.log("*********************************************************");
  console.log("*****************   Customers CSV File Job    *******************");
  console.log("*********************************************************");
  try {

    const allCustomers = await getAllCustomers();
    const EmailsForCustomers = ["nabeelsajid917@gmail.com", "patrick@shiplogic.app"];

    if (allCustomers.length > 0) {
      console.log(`✅ Found ${allCustomers.length} customers to process.`);

      const outputPath = path.resolve(process.cwd(), "customers.csv");
      const ws = fs.createWriteStream(outputPath);
      const csvStream = csv.format({
        headers: [
          "firstName",
          "lastName",
          "email",
          "deliveryMethod",
        ]
      });

      csvStream
        .pipe(ws)
        .on("finish", async () => {
          console.log("✅ CSV created at:", outputPath);

          try {
            await sendEmail(
              EmailsForCustomers,
              "Shopify Customers Delivery Methods",
              "Attached is the customers CSV.",
              [{ filename: "customers.csv", path: outputPath }]
            );

            console.log("📨 Email sent with CSV attachment");
          } catch (emailError) {
            console.error("❌ Failed to send email:", emailError);
          } finally {
            fs.unlink(outputPath, (err) => {
              if (err) {
                console.error("❌ Failed to delete CSV:", err);
              } else {
                console.log("🗑️ CSV file deleted successfully");
              }
            });
          }
        })
        .on("error", console.error);

      // ✍️ Write all customers
      for (let i = 0; i < allCustomers.length; i++) {
        const customer = allCustomers[i];
        csvStream.write({
          firstName: customer?.firstName,
          lastName: customer?.lastName,
          email: customer?.email,
          deliveryMethod: customer?.metafield?.value || "N/A",
        });
      }
      csvStream.end();
    }

    console.log("✅ All pages processed successfully.");
    job.attrs.state = JOB_STATES.COMPLETED;
    job.attrs.lockedAt = null;
    job.attrs.progress = 100;
    await job.save();

    console.log("*****************************************************************");
    console.log("******************   Customers CSV File Job COMPLETED   *****************");
    console.log("*****************************************************************");
    console.log("*****************************************************************");
  } catch (error) {
    const setting = await DB.settings.findOne({ where: { id: 1 } });
    if (!setting) {
      console.log("⚠️ No settings found");
    }
    if (setting?.emailOnErrors) {
      await sendEmail(setting.errorEmails, "Urgent Jobs are Failing", `Shopify Customers CSV File Job is failing, error: ${error.message}`);
    }
    console.log("*****************************************************************");
    console.log("********************   Customers CSV File Job RETRY   *******************");
    console.log("*****************************************************************");
    console.log("error in customers csv file job", error.message);
    console.log("*****************************************************************");

    job.attrs.state = JOB_STATES.FAILED;
    job.attrs.failedAt = new Date();
    job.attrs.failReason = error.message;
    job.attrs.lockedAt = null;
    await job.save();
  }
  done();
});





