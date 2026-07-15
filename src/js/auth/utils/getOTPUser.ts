import getOTPModel from "./getOTPModel.js";
import AppError from "../../utils/AppError.js";

const getOTPUser = async ({
  email,
  purpose,
}: {
  email: string;
  purpose: string;
}) => {
  // otp model
  const OTPModel = getOTPModel();

  // otpuser - if not
  const OTPUser = await OTPModel.findOne({ email, purpose });
  if (!OTPUser)
    throw new AppError({
      message: "No OTP request was found for the provided email address.",
      statusCode: 404,
    });

  return OTPUser;
};

export default getOTPUser;
