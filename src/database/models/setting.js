const Settings = (sequelize, DataTypes) => {
  const SettingModel = sequelize.define(
    "settings",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      inventorySyncEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      inventorySyncInterval: {
        type: DataTypes.STRING, // minutes
        defaultValue: "15 minutes",
      },
      orderImportEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      orderImportInterval: {
        type: DataTypes.STRING, // minutes
        defaultValue: "30 minutes",
      },
      importFBM: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      importFBA: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      requireProductMatch: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      autoMapAsins: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      emailOnErrors: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "settings",
      timestamps: true,
    }
  );

  SettingModel.associate = (models) => {
    // Example: SettingModel.hasMany(models.SomeModel, { foreignKey: "settingId", as: "someModel" });
  };

  return SettingModel;
};

export default Settings;
