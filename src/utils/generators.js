const clean = (val) => {
  if (!val || val === "null" || val === null || val === undefined) return "";
  return String(val).trim();
};

const mapDeliveryMethodToShopify = (methodTag) => {
  switch (methodTag) {
    case "EXPRESS":
      return {
        title: "Express Shipping",
        code: "EXPRESS",
        price: "9.99",
      };

    case "DHL":
      return {
        title: "DHL",
        code: "DHL",
        price: "12.99",
      };

    case "FEDEX":
      return {
        title: "FedEx",
        code: "FEDEX",
        price: "14.99",
      };

    default:
      return {
        title: "Standard Shipping",
        code: "STANDARD",
        price: "4.99",
      };
  }
};

const PRIORITY = ["FEDEX", "DHL", "EXPRESS", "STANDARD"];

const pickHigherPriority = (current, incoming) => {
  // ignore null / undefined / invalid tags
  if (!incoming || !PRIORITY.includes(incoming)) {
    return current;
  }

  if (!current) return incoming;

  return PRIORITY.indexOf(incoming) < PRIORITY.indexOf(current)
    ? incoming
    : current;
};

const normalizeListingItem = (item) => {
  return {
    sku: item.handlerSku || item.sellerSku || item.SKU || "",
    asin: item.asin1 || item.ASIN1 || "",
    title: item.artikelbezeichnung || item.itemName || item.ProductName || "",
    quantity: Number(item.menge || item.quantity || item.Quantity || 0),
    status: item.status || "Unknown",
    fulfillmentChannel: item.versender || item.fulfillmentChannel || "DEFAULT",
    price: item.preis || item.price || null
  };
};

const mapShopifyCustomerToDB = (shopifyCustomer) => {
  return {
    shopifyCustomerId: shopifyCustomer.id,
    email: shopifyCustomer.email || null,
    firstName: shopifyCustomer.firstName || null,
    lastName: shopifyCustomer.lastName || null,
    deliveryMethod: shopifyCustomer.deliveryMethod?.value || null,
    blacklisted:
      shopifyCustomer.blacklisted?.value == "true"
        ? true
        : false,

    numberOfOrders: Number(shopifyCustomer?.numberOfOrders || 0),
  };
};


export {
  clean,
  mapDeliveryMethodToShopify,
  pickHigherPriority,
  normalizeListingItem,
  mapShopifyCustomerToDB
}