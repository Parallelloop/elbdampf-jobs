const ConfirmShipments = (sequelize, DataTypes) => {
    const ConfirmShipment = sequelize.define(
        "confirmShipment",
        {
            orderId: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            marketplaceId: {
                type: DataTypes.STRING,
            },
            isPosted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            confirmShipmentErrors: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            tableName: "confirm_shipments",
            timestamps: true,
        }
    );

    ConfirmShipment.associate = (models) => {
        ConfirmShipment.hasMany(models.packageDetail, {
            foreignKey: "shipmentId",
            as: "packages",
        });
    };

    return ConfirmShipment;
};

export default ConfirmShipments;

