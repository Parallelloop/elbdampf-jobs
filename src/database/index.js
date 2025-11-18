import Sequelize from 'sequelize';
import * as files from './models';
import MYDB from '../config/config.js';

let db = {};
const sequelize = new Sequelize(MYDB.DB_NAME, MYDB.DB_USERNAME, MYDB.DB_PASSWORD, {
  host: MYDB.DB_HOST,
  dialect: MYDB.DB_DIALECT,
  port: MYDB.DB_PORT,
  dialectOptions: {
    connectTimeout: 50000
  },
  pool: {
    max: 150,
    min: 0,
    idle: 10000
  },
  define: {
    timestamps: true
  },
  logging: false
});

Object.keys(files).forEach((fileName) => {
  const model = files[fileName](sequelize, Sequelize.DataTypes);
  db[model.name] = model;
});

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

sequelize.sync();

export default db;
