import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getOTPModel = (route: Route) => {
  const Model = registerModel["otpUser"];

  if (!Model)
    throw new AppError({
      message: "OTP model not found.",
      statusCode: 500,
      code: "CRUD_MODEL_NOT_FOUND",
      hint: "Initialize the OTP model before using OTP authentication.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  return Model;
};

export default getOTPModel;