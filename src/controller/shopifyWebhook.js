import DB from "../database";
import { confirmShipmentPayloadHelper } from "../helper/helper";
import { getShopifyOrder } from "../services/shopify/order";
import { fetchAmazonOrderItems } from "../services/sp-api/orders/order";
import confirmOrderShipment from "../services/sp-api/orders/updating-confrim-shipment";


/**
 * Update confirm shipment status after Amazon response
 */
const updateConfirmShipment = async (amazonOrderId, isSuccess, errors = null) => {
  try {
    const updateData = isSuccess
      ? {
        isPosted: true,
        confirmShipmentErrors: null,
      }
      : {
        confirmShipmentErrors: errors || null,
      };

    await DB.confirmShipment.update(updateData, {
      where: { orderId: amazonOrderId },
    });

    console.log(`ConfirmShipment updated for amazonOrderId: ${amazonOrderId}`);
  } catch (error) {
    console.error(`Failed to update ConfirmShipment ${amazonOrderId}:`, error);
  }
};

/**
 * Main API: Shopify → Amazon Confirm Shipment
 */
const handleFulfillmentWebhook = async (req, res) => {
  try {
    console.log("🚀 ~ handleFulfillmentWebhook ~ req:", JSON.stringify(req.body, null, 2));

    const {
      tracking_company: carrierCode,
      tracking_company: carrierName,
      tracking_number: trackingNumber,
      updated_at: shipDate,
      order_id,
    } = req.body;

    const shopifyOrderId = String(order_id);
    if (
      !shopifyOrderId ||
      !carrierCode ||
      !carrierName ||
      !trackingNumber ||
      !shipDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
      });
    }

    if (!trackingNumber) {
      return res.status(200).send("No tracking");
    }

    // Fetch Shopify order
    const orderResult = await getShopifyOrder(shopifyOrderId);
    if (!orderResult.success || !orderResult.amazonOrderId) {
      console.log("⚠️ Amazon Order ID not found");
      return res.status(400).json({
        success: false,
        message: "Amazon Order ID not found",
      });
    }

    const amazonOrderId = orderResult.amazonOrderId;

    // Already shipped?
    const shipped = await DB.confirmShipment.findOne({
      where: { orderId: amazonOrderId, isPosted: true },
      include: [
        {
          model: DB.packageDetail,
          as: "packages",
          where: { trackingNumber },
          required: false // LEFT JOIN
        }
      ]
    });

    if (shipped && shipped?.packages && shipped?.packages?.length > 0) {
      console.log("🚫 Already shipped to Amazon");
      return res.status(200).json({
        success: true,
        message: "Already shipped",
      });
    }

    const packageReferenceId = Math.floor(Math.random() * 1_000_000_000).toString();

    // Fetch Amazon order items
    const itemsData = await fetchAmazonOrderItems(amazonOrderId);

    if (!itemsData?.OrderItems?.length) {
      return res.status(400).json({
        success: false,
        message: "No Amazon order items found",
      });
    }

    const orderitemsForPayload = itemsData.OrderItems.map((item) => ({
      orderItemId: item.OrderItemId,
      quantity: item.QuantityOrdered,
    }));

    // Prepare package detail
    const packageDetail = {
      packageReferenceId,
      carrierCode,
      carrierName,
      trackingNumber,
      shipDate: new Date(shipDate),
    };

    // Upsert confirm shipment
    const [shipment] = await DB.confirmShipment.upsert(
      {
        orderId: amazonOrderId,
        marketplaceId: "A1PA6795UKMFR9",
        isPosted: false,
      },
      { returning: true }
    );

    // Upsert package detail (1 → many safe)
    await DB.packageDetail.upsert({
      shipmentId: shipment.id,
      packageReferenceId,
      carrierCode,
      carrierName,
      shippingMethod: "",
      trackingNumber,
      shipDate: new Date(shipDate),
    });

    // Build Amazon payload
    const payload = confirmShipmentPayloadHelper(
      orderitemsForPayload,
      packageDetail
    );

    console.log("🚀 ConfirmShipment Payload:", JSON.stringify(payload, null, 2));

    // Send shipment confirmation to Amazon
    const responseShipment = await confirmOrderShipment({
      orderId: amazonOrderId,
      body: payload,
    });

    console.log("🚀 Amazon Response:", responseShipment);

    // Handle Amazon response
    if (responseShipment?.success === true) {
      await updateConfirmShipment(amazonOrderId, true);
      // Mark order as shipped
      await DB.orders.update(
        { orderStatus: "Shipped" },
        { where: { orderId: amazonOrderId } }
      );
    } else {
      await updateConfirmShipment(
        amazonOrderId,
        false,
        JSON.stringify(responseShipment?.errors)
      );

      return res.status(400).json({
        success: false,
        message: responseShipment?.errors || "Amazon shipment confirmation failed",
      });
    }

    return res.json({
      success: true,
      message: "Fulfillment status updated successfully.",
    });
  } catch (err) {
    console.error("Error updating fulfillment status:", err);
    return res.status(500).json({ success: false, message: "Failed to update fulfillment status." });
  }
};

export {
  handleFulfillmentWebhook,
};