import type { Response } from "express";
import appResponse from "../../utils/response.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const otpVerifiedResponse = ({
  res,
  body,
  routeObj,
}: {
  res: Response;
  body: any;
  routeObj: Route;
}) => {
  if (!body.purpose)
    throw new AppError({
      message: "purpose is required.",
      statusCode: 400,
      hint: "Provide purpose before sending the OTP verification response.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  appResponse({
    res,
    message: `${body.purpose}: OTP verified successfully!`,
    purpose: body.purpose
  });
};

export default otpVerifiedResponse;