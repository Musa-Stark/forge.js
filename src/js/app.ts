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
import helmet from "helmet";
import { rateLimiter } from "./middleware/rateLimit.middleware.js";
import healthCollection from "./health/health.collection.js";
import { setCollectionInfo } from "./terminal/collectionInfo.js";
import printInfo from "./terminal/terminal.js";

// body - middlewares
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: true });
app.use(cookieParser());
app.use(helmet());
app.use(rateLimiter());

// parse body - based on situation
app.use((req, res, next) => {
  if (req.is("multipart/form-data")) {
    return next();
  }

  jsonParser(req, res, (err) => {
    if (err) return next(err);

    urlencodedParser(req, res, next);
  });
});

// handle collection
const handleCollection = (collections: Collection[]): void => {
  for (const Req of collections) {
    setCollectionInfo(Req);

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

  printInfo()
};

// start server
const startServer = async (): Promise<void> => {
  const { port, collections, isOffline, mongoDBURI, databaseName } = getEnvs();
  // connect db
  await connectDB({ isOffline, mongoDBURI, databaseName });

  // call - handleCollection
  if (collections) {
    handleCollection([healthCollection, ...collections!]);
  } else {
    handleCollection([healthCollection]);
  }

  // routeObj not found
  app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // error middleware
  app.use(errorMiddleware);

  app.listen(port, () =>
    AppLog("check", "app", `Server is running at http://localhost:${port}`),
  );
};

export { startServer, app };
