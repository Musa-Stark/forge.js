import StarkNexus, {
  collection,
  mongooseFields,
  zodFields,
  startServer,
} from "./dist/js/index.js";
import {
  healthCollection,
  authCollection,
} from "./collections/index.js";

new StarkNexus({
  collections: [healthCollection, authCollection],
  apiVersion: 1,
  isOffline: process.env.ISOFFLINE,
  databaseName: process.env.DATABASE_NAME,
  mongoDBURI: process.env.MONGODB_URI,
});

startServer();
