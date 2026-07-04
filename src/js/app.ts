import express from "express";
const app = express();
import { getEnvs } from "./config/envs.js";
import type { Collection } from "./types/Collection.js";
import handleReqType from "./config/handleReqType.js";
import errorMiddleware from "./middleware/error.middleware.js";

// handle collection
const handleCollection = (collections: Collection[]): void => {
  for (const Req of collections) {
    handleReqType(Req.reqType, app, Req.routeName, Req.routes);
  }
};

// start server
const startServer = (): void => {
  const { port, collections } = getEnvs();

  // call - handleCollection
  handleCollection(collections!);

  app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });
  app.use(errorMiddleware);

  app.listen(port, () =>
    console.log(`Server is running at http://localhost:${port}`),
  );
};

export default startServer;
