const PackageDetail = (sequelize, DataTypes) => {
  const PackageDetailModel = sequelize.define(
    "packageDetail",
    {
      shipmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "confirm_shipments", key: "id" },
      },
      packageReferenceId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      carrierCode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      carrierName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      shippingMethod: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      trackingNumber: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      shipDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "package_details",
      timestamps: true,
    }
  );

  PackageDetailModel.associate = (models) => {
    PackageDetailModel.belongsTo(models.confirmShipment, {
      foreignKey: "shipmentId",
      as: "shipment",
    });
  };

  return PackageDetailModel;
};

export default PackageDetail;
