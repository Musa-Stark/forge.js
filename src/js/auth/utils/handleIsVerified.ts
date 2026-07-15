import AppError from "../../utils/AppError.js";
import getOTPUser from "./getOTPUser.js";

const handleIsVerified = async ({
  email,
  purpose,
}: {
  email: string;
  purpose: string;
}) => {
  const isOTPUser = await getOTPUser({ email, purpose });

  let isVerified = false;
  if (isOTPUser) {
    // if isVerfied
    if (isOTPUser.isVerified) {
      isVerified = true;
    } else {
      // if not verified
      throw new AppError({
        message: "Please verify your email address before creating an account.",
        statusCode: 409,
      });
    }
  }

  return { isVerified, isOTPUser };
};

export default handleIsVerified;
