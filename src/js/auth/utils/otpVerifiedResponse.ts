import type { Response } from "express";
import appResponse from "../../utils/response.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";

const otpVerifiedResponse = ({
  res,
  body,
  routeObj,
}: {
  res: Response;
  body: any;
  routeObj: Route;
}) => {
  // get dynamic auth field key
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const purposeKey = fieldsObj?.purpose;

  if (!body?.[purposeKey!])
    throw new AppError({
      message: `${purposeKey} is required.`,
      statusCode: 400,
      hint: `Provide ${purposeKey} before sending the OTP verification response.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  appResponse({
    res,
    message: `${body[purposeKey!]}: OTP verified successfully!`,
    purpose: body[purposeKey!],
  });
};

export default otpVerifiedResponse;