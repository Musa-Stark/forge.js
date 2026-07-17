import { v2 as cloudinary } from "cloudinary";
import { getEnvs } from "./envs.js";
import AppError from "../utils/AppError.js";

// setup cloudinary
const setupCloudinary = () => {
  const { cloudinaryAPIKey, cloudinaryCloudName, cloudinaryAPISecret } =
    getEnvs();

  if (!cloudinaryAPIKey || !cloudinaryCloudName || !cloudinaryAPISecret)
    throw new AppError({
      message:
        "cloudinaryAPIKey, cloudinaryCloudName and cloudinaryAPISecret are required",
      statusCode: 409,
    });

  cloudinary.config({
    cloud_name: cloudinaryCloudName as string,
    api_key: cloudinaryAPIKey as string,
    api_secret: cloudinaryAPISecret as string,
  });
};

export { cloudinary, setupCloudinary };
