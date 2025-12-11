const Inventory = (sequelize, DataTypes) => {
  const Inventory = sequelize.define("inventories", {
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    shopifyQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    amazonQty: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    }
  });

  return Inventory;
};

export default Inventory;
