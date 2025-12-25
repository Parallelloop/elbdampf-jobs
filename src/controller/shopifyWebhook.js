import DB from "../database";
import { confirmShipmentPayloadHelper } from "../helper/helper";
import { fetchAmazonOrderItems } from "../services/sp-api/orders/order";
import confirmOrderShipment from "../services/sp-api/orders/updating-confrim-shipment";


/**
 * Update confirm shipment status after Amazon response
 */
const updateConfirmShipment = async (orderId, isSuccess, errors = null) => {
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
            where: { orderId },
        });

        console.log(`ConfirmShipment updated for orderId: ${orderId}`);
    } catch (error) {
        console.error(`Failed to update ConfirmShipment ${orderId}:`, error);
    }
};

/**
 * Main API: Shopify → Amazon Confirm Shipment
 */
const handleFulfillmentWebhook = async (req, res) => {
  try {
    console.log("🚀 ~ handleFulfillmentWebhook ~ req:", JSON.stringify(req.body, null, 2));

     return res.json({
      success: true,
      message: "Fulfillment status updated successfully.",
    });

    const {
      tracking_company: carrierCode,
      tracking_company: carrierName,
      tracking_number: trackingNumber,
      updated_at: shipDate,
      order_id: orderId,
    } = req.body;

    if (
      !orderId ||
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

    // Already shipped?
    const shipped = await DB.confirmShipment.findOne({
      where: { orderId, isPosted: true },
      include: [{ model: DB.packageDetail, where: { trackingNumber }, required: false }],
    });

    if (shipped) {
      console.log("🚫 Already shipped to Amazon");
      return res.status(200).json({
        success: true,
        message: "Already shipped",
      });
    }

    const packageReferenceId = Math.floor(Math.random() * 1_000_000_000).toString();

    // Fetch Amazon order items
    const itemsData = await fetchAmazonOrderItems(orderId);
    console.log("🚀 ~ updatingConfirmShipment ~ itemsData:", itemsData)

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
    console.log("🚀 ~ updatingConfirmShipment ~ orderitemsForPayload:", orderitemsForPayload)

    // Prepare package detail
    const packageDetail = {
      packageReferenceId,
      carrierCode,
      carrierName,
      trackingNumber,
      shipDate: new Date(shipDate),
    };
    console.log("🚀 ~ updatingConfirmShipment ~ packageDetail:", packageDetail)

    // Upsert confirm shipment
    const [shipment] = await DB.confirmShipment.upsert(
      {
        orderId,
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

    console.log("🚀 ConfirmShipment Payload:", payload);

    // Send shipment confirmation to Amazon
    const responseShipment = await confirmOrderShipment({
      orderId,
      body: payload,
    });

    console.log("🚀 Amazon Response:", responseShipment);

    // Handle Amazon response
    if (responseShipment?.success === true) {
      await updateConfirmShipment(orderId, true);

      // Mark order as shipped
      await DB.orders.update(
        { orderStatus: "Shipped" },
        { where: { orderId } }
      );
    } else {
      await updateConfirmShipment(
        orderId,
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