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
  });

  Product.associate = (models) => {
    Product.hasOne(models.inventories, { foreignKey: "productId" });
  };

  return Product;
};

export default Products;
