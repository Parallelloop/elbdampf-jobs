import getSpAPIClient from "../client";
const { NODE_ENV } = process.env;

const confirmOrderShipment = async ({ orderId, body }) => {
    try {
        const spClient = getSpAPIClient();
        if (NODE_ENV == "development") {
            return {
                success: true,
                response: {},
            };

        }
        const response = await spClient.callAPI({
            operation: "confirmShipment",
            endpoint: "orders",
            body,
            path: {
                orderId
            },
        });
        // console.log("🚀 ~ confirmOrderShipment ~ response:", response)
        return {
            success: true,
            response,
        };
    } catch (error) {
        console.log("🚀 ~ confirmOrderShipment ~ error:", error)
        return {
            success: false,
            errors: error,
        };
    }
};

export default confirmOrderShipment;
