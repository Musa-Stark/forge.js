import getOTPModel from "./getOTPModel.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getOTPUser = async ({
  email,
  purpose,
  routeObj,
}: {
  email: string;
  purpose: string;
  routeObj: Route;
}) => {
  // otp model
  const OTPModel = getOTPModel(routeObj);

  // otp user
  const OTPUser = await OTPModel.findOne({ email, purpose });

  if (!OTPUser)
    throw new AppError({
      message: "OTP request not found.",
      statusCode: 404,
      hint: "Request a new OTP or verify the provided email and purpose.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  return OTPUser;
};

export default getOTPUser;