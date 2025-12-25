
const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const confirmShipmentPayloadHelper = (orderItems, packageDetail) => {

  const body = {
    packageDetail: {
      ...packageDetail,
      orderItems
    },
    marketplaceId: "A1PA6795UKMFR9",
  };

  return body;
};

export {
    sleep,
    confirmShipmentPayloadHelper
}
