import express from "express";
import jobs from "./jobs";
import ShopifyWebhook from './ShopifyWebhooks'
import { authenticateSpecialToken } from "../middlewares/auth";
const router = express.Router();

router.use("/jobs", jobs);
router.use("/shopify-webhooks", ShopifyWebhook);

export default router;
