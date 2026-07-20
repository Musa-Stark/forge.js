import AppError from "../../utils/AppError.js";
import getOTPUser from "./getOTPUser.js";
import type { Route } from "../../types/Collection.js";

const handleIsVerified = async ({
  email,
  purpose,
  route,
}: {
  email: string;
  purpose: string;
  route: Route;
}) => {
  const isOTPUser = await getOTPUser({
    email,
    purpose,
    route,
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
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });
    }
  }

  return { isVerified, isOTPUser };
};

export default handleIsVerified;