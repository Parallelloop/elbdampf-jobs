import mongoose from "mongoose";
const { MONGO_URL } = process.env;

mongoose.set("useNewUrlParser", true);
mongoose.set("useCreateIndex", true);
const option = {
  socketTimeoutMS: 30000,
  keepAlive: true,
  reconnectTries: 30000,
};
mongoose
  .connect(MONGO_URL, option, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async (db) => {
    console.log("MongoDB Connected");
  })
  .catch((err) => console.log("MongoDB::", err));
