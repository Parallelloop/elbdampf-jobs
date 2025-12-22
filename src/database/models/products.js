const Products = (sequelize, DataTypes) => {
  const Product = sequelize.define("products", {
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    asin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "Unknown",
    },
    shippingMethod: {
      type: DataTypes.STRING,
      defaultValue: "Unknown",
    },
    deliveryMethodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "delivery_methods",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  });

  Product.associate = (models) => {
    Product.hasOne(models.inventories, { foreignKey: "productId" });
    Product.belongsTo(models.deliveryMethod, { foreignKey: "deliveryMethodId", as: "deliveryMethod" });
  };

  return Product;
};

export default Products;
