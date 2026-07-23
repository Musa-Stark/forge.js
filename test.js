import StarkNexus, {
  startServer,
  generateJWTSecret,
  generateMasterKey,
} from "./dist/js/index.js";
import "dotenv/config";

import {
  authCollection,
  crudCollection,
} from "./collections/index.js";

new StarkNexus({
  collections: [authCollection, crudCollection],
  port: 10000,
  apiVersion: 1,
  isOffline: process.env.ISOFFLINE === "true",
  databaseName: process.env.DATABASE_NAME,
  mongoDBURI: process.env.MONGODB_URI,
  adminEmailSender: process.env.ADMIN_EMAIL_SENDER,
  resendAPIKey: process.env.RESEND_API_KEY,
  domain: process.env.DOMAIN,
  jwtSecret: process.env.JWT_SECRET,
  cloudinaryAPIKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryAPISecret: process.env.CLOUDINARY_API_SECRET,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryFolderName: process.env.CLOUDINARY_FOLDER_NAME,
});

startServer();