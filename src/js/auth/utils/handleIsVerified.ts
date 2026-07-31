import AppError from "../../utils/AppError.js";
import getOTPUser from "./getOTPUser.js";
import type { Route } from "../../types/Collection.js";
import getErrorDetail from "../../utils/getErrorDetail.js";


const handleIsVerified = async ({
  email,
  purpose,
  routeObj,
}: {
  email: string;
  purpose: string;
  routeObj: Route;
}) => {
  const isOTPUser = await getOTPUser({
    email,
    purpose,
    routeObj,
  });

  let isVerified = false;

  if (isOTPUser) {
    if (isOTPUser.isVerified) {
      isVerified = true;
    } else {
      throw new AppError({
        message: "Email address is not verified.",
        statusCode: 403,
        code: "AUTH_FORBIDDEN",
        hint: "Verify your email address before continuing.",
        details: getErrorDetail(routeObj),
      });
    }
  }

  return { isVerified, isOTPUser };
};

export default handleIsVerified;