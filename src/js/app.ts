import express from "express";
const app = express();
import { getEnvs } from "./config/envs.js";
import type { Collection } from "./types/Collection.js";
import handleReqType from "./config/handleReqType.js";
import errorMiddleware from "./middleware/error.middleware.js";
import createModel from "./lib/model.factory.js";
import registerModel from "./lib/model.registry.js";
import connectDB from "./lib/db.js";
import AppLog from "./utils/AppLog.js";
import cookieParser from "cookie-parser";

// body - middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// handle collection
const handleCollection = (collections: Collection[]): void => {
  for (const Req of collections) {
    const { routeName, modelName, mongooseSchemaObj } = Req;
    if (modelName) {
      const MODEL = createModel(routeName, modelName, mongooseSchemaObj!);
      registerModel[modelName] = MODEL;
    }

    handleReqType(
      Req.reqType,
      app,
      Req.routeName,
      Req.routesArray,
      Req.modelName,
      Req.validationsObj,
      Req.mongooseSchemaObj,
    );
  }
};

// start server
const startServer = async (): Promise<void> => {
  const { port, collections, isOffline, mongoDBURI, databaseName } = getEnvs();
  // connect db
  await connectDB({ isOffline, mongoDBURI, databaseName });

  // call - handleCollection
  handleCollection(collections!);

  // route not found
  app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // error middleware
  app.use(errorMiddleware);

  app.listen(port, () =>
    AppLog("check", "app", `Server is running at http://localhost:${port}`),
  );
};

export default startServer;
