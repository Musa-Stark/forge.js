import StarkNexus, {
  startServer,
  generateJWTSecret,
  generateMasterKey,
} from "./dist/js/index.js";
import "dotenv/config"

import { healthCollection, authCollection } from "./collections/index.js";

new StarkNexus({
  collections: [healthCollection, authCollection],
  apiVersion: 1,
  isOffline: process.env.ISOFFLINE === "true",
  databaseName: process.env.DATABASE_NAME,
  mongoDBURI: process.env.MONGODB_URI,
  adminEmailSender: process.env.ADMIN_EMAIL_SENDER,
  resendAPIKey: process.env.RESEND_API_KEY,
});

startServer();