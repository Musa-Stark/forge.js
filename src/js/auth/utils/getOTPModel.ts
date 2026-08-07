import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getOTPModel = (routeObj: Route) => {
  const Model = registerModel["otpUser"];

  if (!Model)
    throw new AppError({
      message: "OTP model not found.",
      statusCode: 500,
      hint: "Initialize the OTP model before using OTP authentication.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  return Model;
};

export default getOTPModel;