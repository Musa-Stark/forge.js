import getOTPModel from "./getOTPModel.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getOTPUser = async ({
  email,
  purpose,
  route,
}: {
  email: string;
  purpose: string;
  route: Route;
}) => {
  // otp model
  const OTPModel = getOTPModel(route);

  // otp user
  const OTPUser = await OTPModel.findOne({ email, purpose });

  if (!OTPUser)
    throw new AppError({
      message: "OTP request not found.",
      statusCode: 404,
      code: "CRUD_ITEM_NOT_FOUND",
      hint: "Request a new OTP or verify the provided email and purpose.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  return OTPUser;
};

export default getOTPUser;