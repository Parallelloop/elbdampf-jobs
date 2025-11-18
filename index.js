import "dotenv/config";
import express from "express";
import Agenda from "./src/config/agenda-jobs";
import applyMiddlewares from "./src/middlewares";
import router from "./src/routes";
import fixture from "./src/config/fixture";
import "./src/jobs";
import "./src/config/database";
import "./src/database/mongo-models";
const app = express();

applyMiddlewares(app);

app.use("/api/v1", router);

app.listen(process.env.PORT, async () => {
  console.log(`app is listening to port ${process.env.PORT}`);
  await Agenda._ready;
  await Agenda.start();
  await fixture();
});
export default app;
