import express  from "express";
import type { Express } from "express";
const app: Express = express();
import { getEnvs } from "./config/envs.js";
import type { Collection } from "./types/Collection.js";
import handleReqType from "./config/handleReqType.js";
import errorMiddleware from "./middleware/error.middleware.js";
import createModel from "./lib/model.factory.js";
import registerModel from "./lib/model.registry.js";
import connectDB from "./lib/db.js";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimiter } from "./middleware/rateLimit.middleware.js";
import healthCollection from "./health/health.collection.js";
import authCollection from "./auth/builtin/auth.collection.js";
import { setAppInfo } from "./terminal/appInfo.js";
import printInfo from "./terminal/loggerConfig.js";
import type { AuthConfig } from "./types/Constructor.js";
import createRefreshModel from "./config/refreshModel.js";

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
const handleCollection = (
  collections: Collection[],
  authConfigObj: AuthConfig,
): void => {
  for (const Req of collections) {
    setAppInfo(Req);

    let {
      type,
      route,
      routes,
      model,
      validations,
      schema,
    } = Req;

    if (type === "auth" && authConfigObj.mode === "builtin") {
      schema = authConfigObj.schemaObj?.schema!;
      model = authConfigObj.schemaObj?.model!;
    }

    if (model) {
      const MODEL = createModel(model, schema!, route);
      registerModel[model] = MODEL;
    }

    handleReqType(
      type,
      app,
      route,
      routes,
      model,
      validations,
      schema,
    );
  }
};

// start server
const startServer = async (): Promise<void> => {
  const {
    port,
    collections,
    isOffline,
    mongoDBURI,
    databaseName,
    authConfigObj,
  } = getEnvs();
  // connect db
  await connectDB({ isOffline, mongoDBURI, databaseName });
  await createRefreshModel()

  // collectionsArray
  const collectionArray = [healthCollection];

  // handleCollection config
  if (authConfigObj?.mode === "builtin") collectionArray.push(authCollection);
  if (collections) collectionArray.push(...collections);

  // call - handleCollection
  handleCollection(collectionArray, authConfigObj!);

  // routeObj not found
  app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // error middleware
  app.use(errorMiddleware);

  // app.listen(port, printInfo);
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
};

export { startServer, app };
