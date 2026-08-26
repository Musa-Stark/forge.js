import getOTPModel from "./getOTPModel.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";

const getOTPUser = async ({
  email,
  purpose,
  routeObj,
}: {
  email: string;
  purpose: string;
  routeObj: Route;
}) => {
  // get dynamic auth field keys
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const emailKey = fieldsObj?.email;
  const purposeKey = fieldsObj?.purpose;

  // otp model
  const OTPModel = getOTPModel(routeObj);

  // otp user
  const OTPUser = await OTPModel.findOne({
    [emailKey!]: email,
    [purposeKey!]: purpose,
  });

  if (!OTPUser)
    throw new AppError({
      message: "OTP request not found.",
      statusCode: 404,
      hint: `Request a new OTP or verify the provided ${emailKey} and ${purposeKey}.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  return OTPUser;
};

export default getOTPUser;