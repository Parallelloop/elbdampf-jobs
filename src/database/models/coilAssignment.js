const CoilAssignment = (sequelize, DataTypes) => {
  const CoilAssignment = sequelize.define("coilAssignments", {
    customerId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  return CoilAssignment;
};

export default CoilAssignment;