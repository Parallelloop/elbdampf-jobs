import Agenda from "../../config/agenda-jobs";
import DB from "../../database";
import { getAllCustomersForDB } from "../../services/shopify/customer";
import { JOB_STATES } from "../../utils/constants";
import { sendEmail } from "../../utils/send-email";

// Agenda Job
Agenda.define("customers-save", { concurrency: 1, lockLifetime: 30 * 60000 }, async (job, done) => {
    console.log("*********************************************************");
    console.log("************ Customers Database Sync Job ***************");
    console.log("*********************************************************");

    try {
      const allCustomers = await getAllCustomersForDB();

      if (!allCustomers.length) {
        console.log("⚠️ No customers found");
        return done();
      }

      const BATCH_SIZE = 1000;
      let processed = 0;

      for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
        const batch = allCustomers.slice(i, i + BATCH_SIZE);

        await DB.customers.bulkCreate(batch, {
          updateOnDuplicate: [
            "email",
            "firstName",
            "lastName",
            "deliveryMethod",
            "numberOfOrders",
            "blacklisted",
          ],
        });

        processed += batch.length;
        job.attrs.progress = Math.round((processed / allCustomers.length) * 100);
        await job.save();

        console.log(`🚀 Synced ${processed}/${allCustomers.length} customers`);
      }

      job.attrs.state = JOB_STATES.COMPLETED;
      job.attrs.lockedAt = null;
      job.attrs.progress = 100;
      await job.save();

      console.log("*********************************************************");
      console.log("************ Customers Database Sync Job COMPLETED ******");
      console.log("*********************************************************");
    } catch (error) {
      console.log("*********************************************************");
      console.log("************ Customers Database Sync Job FAILED ********");
      console.log("*********************************************************");

      console.error("Error:", error.message);

      job.attrs.state = JOB_STATES.FAILED;
      job.attrs.failedAt = new Date();
      job.attrs.failReason = error.message;
      job.attrs.lockedAt = null;
      await job.save();
    }

    done();
  }
);





