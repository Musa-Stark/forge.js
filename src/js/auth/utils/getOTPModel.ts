import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";

const getOTPModel = () => {
  const Model = registerModel["otpUser"];
  if (!Model)
    throw new AppError({
      message: "OTP service is currently not available",
      statusCode: 409,
    });

  return Model;
};

export default getOTPModel;
