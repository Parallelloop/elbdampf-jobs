const getRDTNtoken = async ({ spClient }) => {
    try {
        const data = await spClient.callAPI({
            operation: "createRestrictedDataToken",
            endpoint: "tokens",
            body: {
                restrictedResources: [
                    {
                        "method": "GET",
                        "path": "/orders/v0/orders",
                        "dataElements": [
                            "buyerInfo",
                            "shippingAddress"
                        ]
                    }
                ]
            },
            version: '2021-03-01'
        });
        return data?.restrictedDataToken;
    } catch (error) {
        return false;
    }
};

export default getRDTNtoken;