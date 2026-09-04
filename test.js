import StarkNexus, {
  startServer,
  generateJWTSecret,
  generateMasterKey,
  app,
  fields,
} from "./dist/js/index.js";

import {
  crudCollection,
  userCollection,
  accountCollection,
  actionCollection,
  recentCollection
} from "./collections/index.js";

import "dotenv/config";

new StarkNexus({
  authConfigObj: {
    mode: "builtin",
    schemaObj: {
      model: "User",
      schema: {
        firstName: fields.requiredString,
        lastName: fields.optionalString,
        email: fields.email,
        password: fields.password,
        profileImage: fields.optionalFileMetaData
      },
    },

    accessTokenAge: "1d",

    loginMode: "credentials",
    signupMode: "credentials"
  },

  collections: [
    crudCollection,
    userCollection,
    accountCollection,
    actionCollection,
    recentCollection
  ],
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
  masterKey: process.env.MASTER_KEY,
});

startServer();
