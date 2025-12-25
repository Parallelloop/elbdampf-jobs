import express from 'express';

import { handleFulfillmentWebhook } from "../controller/shopifyWebhook.js";

const router = express.Router();

router.post('/fulfillments-update/', handleFulfillmentWebhook);

export default router;
