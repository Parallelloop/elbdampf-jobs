const Orders = (sequelize, DataTypes) => {

  const Orders = sequelize.define("orders", {
    orderId: {
      type: DataTypes.STRING,
      unique: true,
    },
    orderStatus: {
      type: DataTypes.STRING,
    },
    purchaseDate: {
      type: DataTypes.STRING,
    },
    // ------- Buyer Info -------
    buyerEmail: {
      type: DataTypes.STRING,
    },
    buyerName: {
      type: DataTypes.STRING,
    },
    // ------- Shipping Address -------
    addressLine1: {
        type: DataTypes.STRING,
    },
    addressLine2: {
      type: DataTypes.STRING,
    },
    city: {
      type: DataTypes.STRING,
    },
    stateOrRegion: {
      type: DataTypes.STRING,
    },
    postalCode: {
      type: DataTypes.STRING,
    },
    countryCode: {
      type: DataTypes.STRING,
    },
    addressType: {
      type: DataTypes.STRING,
    },
    orderErrors: {
      type: DataTypes.JSON,
    },
    isPosted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    timestamps: true,
  });

  return Orders;
};

export default Orders;