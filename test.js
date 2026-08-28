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
  authCollection,
  accountCollection,
} from "./collections/index.js";

import "dotenv/config";

new StarkNexus({
  authConfigObj: {
    fieldsObj: {
      otp: "otp",
      purpose: "purpose",
      email: "Email",
      password: "password",
    },

    mode: "builtin",

    returnAccessToken: true,
    returnRefreshToken: true,

    accessTokenName: "access_token",

    rotateRefreshToken: true,
    refreshTokenRotationInterval: "24h",

    accessTokenAge: "1h",
    refreshTokenAge: "30d",

    schemaObj: {
      modelName: "Stark",
      schema: {
        name: fields.requiredString,
        Email: fields.requiredString,
        password: fields.password,
        stark: fields.booleanTrue,
      },
    },
    loginMode: "credentials",
    signupMode: "credentials",
  },
  collections: [
    crudCollection,
    userCollection,
    authCollection,
    accountCollection,
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
  masterKey: "jr0frt78n0gm6HRF2KO6JUse2XjPCcKug/Ys6ARzKLw=",
});

startServer();
