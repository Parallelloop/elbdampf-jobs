
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

const getCustomerMetafield = (customer, namespace, key) => {
  const edges = customer?.metafields?.edges || [];
  const field = edges.find(
    (e) => e.node.namespace === namespace && e.node.key === key
  );
  return field ? field.node : null;
}

export {
    sleep,
    confirmShipmentPayloadHelper,
    getCustomerMetafield
}
