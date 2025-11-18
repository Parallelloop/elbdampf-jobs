const mapAmazonToShopifyOrders = (amazonOrders) => {
  if (!amazonOrders || !amazonOrders.Orders) return [];

  return amazonOrders.Orders.map(order => {
    const { ShippingAddress, OrderItems, AmazonOrderId, PurchaseDate, OrderTotal } = order;

    const [firstName, ...lastNameParts] = ShippingAddress?.Name?.split(' ') || ['Customer', ''];
    const lastName = lastNameParts.join(' ');

    return {
      order: {
        line_items: OrderItems.map(item => ({
          title: item.Title,
          sku: item.SellerSKU,
          quantity: item.QuantityOrdered,
          price: item.ItemPrice?.Amount || '0.00'
        })),
        customer: {
          first_name: firstName,
          last_name: lastName,
          email: order.BuyerEmail || 'no-email@example.com'
        },
        shipping_address: {
          address1: ShippingAddress?.AddressLine1 || '',
          address2: ShippingAddress?.AddressLine2 || '',
          city: ShippingAddress?.City || '',
          zip: ShippingAddress?.PostalCode || '',
          country: ShippingAddress?.CountryCode || '',
          phone: ShippingAddress?.Phone || ''
        },
        financial_status: 'paid',
        tags: 'Amazon FBM',
        note: `Amazon Order ID: ${AmazonOrderId}`
      }
    };
  });
}


export {
    mapAmazonToShopifyOrders
}
