import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import getOTPUser from "./utils/getOTPUser.js";
import handleIsVerified from "./utils/handleIsVerified.js";
import getUser from "./utils/getUser.js";
import { hash } from "../utils/libsodium.js";
import getOTPModel from "./utils/getOTPModel.js";
import appResponse from "../utils/response.js";
import getValidationKey from "../utils/validationKeyError.js";

const resetPassword = ({
  modelName,
  route,
  routeName,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(route, validationsObj);

    // validate
    const body = validate(validationObj, req.body);

    // if no email or password in validation
    if (!req.body.email || !req.body.password)
      throw new AppError({
        message:
          "collection error: email and password are required to reset password in validationsObj",
        statusCode: 409,
      });

    // OTPUser
    await getOTPUser({
      email: body.email as string,
      purpose: "password_reset",
    });

    // handle is verified or not
    const { isVerified, isOTPUser } = await handleIsVerified({
      email: body.email as string,
      purpose: "password_reset",
    });

    // user
    const user = await getUser({
      modelName,
      routeName,
      email: body.email as string,
    });

    // update password
    user.password = await hash(body.password as string);
    // save user
    user.save();

    const OTPModel = getOTPModel();
    if (isVerified)
      await OTPModel?.deleteOne({
        email: body.email as string,
        purpose: "password_reset",
      });

    appResponse({
      res,
      message: "Password reset successfully!",
      data: {
        nextStep: "got to /login",
      },
    });
  };
};

export default resetPassword;
