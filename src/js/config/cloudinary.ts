import { v2 as cloudinary } from "cloudinary";
import { getEnvs } from "./envs.js";
import AppError from "../utils/AppError.js";
import type { Route } from "../types/Collection.js";

// setup cloudinary
const setupCloudinary = (routeObj: Route) => {
  const { cloudinaryAPIKey, cloudinaryCloudName, cloudinaryAPISecret } =
    getEnvs();

  if (!cloudinaryAPIKey || !cloudinaryCloudName || !cloudinaryAPISecret)
    throw new AppError({
      message:
        "cloudinaryAPIKey, cloudinaryCloudName and cloudinaryAPISecret are required",
      statusCode: 409,
      code: "CLOUDINARY_CONFIGURATION_INVALID",
      hint: "Make sure you have provided all these 3 in order to use cloudinary as a file storage service",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  cloudinary.config({
    cloud_name: cloudinaryCloudName as string,
    api_key: cloudinaryAPIKey as string,
    api_secret: cloudinaryAPISecret as string,
  });
};

export { cloudinary, setupCloudinary };
