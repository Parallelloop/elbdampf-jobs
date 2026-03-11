const Customer = (sequelize, DataTypes) => {
  const Customer = sequelize.define("customers", {
    shopifyCustomerId: {
      type: DataTypes.STRING,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
    },
    firstName: {
      type: DataTypes.STRING,
    },

    lastName: {
      type: DataTypes.STRING,
    },
    deliveryMethod: {
      type: DataTypes.STRING, // "coils", "standard"
      allowNull: true,
      defaultValue: null,
      index: true,
    },
    blacklisted: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    numberOfOrders: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  });

  return Customer;
};

export default Customer;
