const DeliveryMethods = (sequelize, DataTypes) => {
	const DeliveryMethod = sequelize.define(
		"deliveryMethod",
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},

			title: {
				type: DataTypes.STRING,
				allowNull: false,
			},

			description: {
				type: DataTypes.TEXT,
				allowNull: true,
			},

			tag: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			priority: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 99,
			},
			status: {
				type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
				defaultValue: "ACTIVE",
			},
		},
		{
			tableName: "delivery_methods",
			timestamps: true,
		}
	);

	DeliveryMethod.associate = (models) => {
		DeliveryMethod.hasMany(models.products, {
			foreignKey: "deliveryMethodId",
			as: "products",
		});
	};

	return DeliveryMethod;
};

export default DeliveryMethods;

