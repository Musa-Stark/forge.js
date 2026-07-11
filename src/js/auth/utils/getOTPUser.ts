import getOTPModel from "./getOTPModel.js";
import AppError from "../../utils/AppError.js";

const getOTPUser = async (email: string) => {
  const OTPModel = getOTPModel();
  const OTPUser = await OTPModel.findOne({ email });
  if (!OTPUser)
    throw new AppError({
      message: "No OTP request was found for the provided email address.",
      statusCode: 404,
    });

  return OTPUser;
};

export default getOTPUser;
