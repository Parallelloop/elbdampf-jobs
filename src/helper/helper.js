
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

const getMostUsedDeliveryMethod = (orders) => {
  const counter = {};

  for (const edge of orders) {
    const title = edge?.node?.shippingLine?.title;
    if (!title) continue;

    counter[title] = (counter[title] || 0) + 1;
  }

  if (!Object.keys(counter).length) return null;

  return Object.entries(counter).reduce((max, current) =>
    current[1] > max[1] ? current : max
  )[0];
};

export {
    sleep,
    confirmShipmentPayloadHelper,
    getMostUsedDeliveryMethod
}
