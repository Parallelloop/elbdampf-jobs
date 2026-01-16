const ProductHealthStats = (sequelize, DataTypes) => {
  const ProductHealthStatsModel = sequelize.define(
    "productHealthStats",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      totalProducts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      mappedProducts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      unmappedProducts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      mappedPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      unmappedPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "product_health_stats",
      timestamps: true,
    }
  );

  ProductHealthStatsModel.associate = (models) => {
    // No relations needed for now
  };

  return ProductHealthStatsModel;
};

export default ProductHealthStats;
