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
    const body = validate(validationObj, req.body, route);

    // if no email or password in request
    if (!req.body.email || !req.body.password)
      throw new AppError({
        message: "email and password are required.",
        statusCode: 400,
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        hint: "Provide email and password in the request body.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // OTPUser
    await getOTPUser({
      email: body.email as string,
      purpose: "password_reset",
      route,
    });

    // handle is verified or not
    const { isVerified } = await handleIsVerified({
      email: body.email as string,
      purpose: "password_reset",
      route
    });

    // user
    const user = await getUser({
      modelName,
      routeName,
      email: body.email as string,
      route
    });

    // update password
    user.password = await hash(body.password as string, route);

    // save user
    await user.save();

    const OTPModel = getOTPModel(route);

    if (isVerified)
      await OTPModel.deleteOne({
        email: body.email as string,
        purpose: "password_reset",
      });

    appResponse({
      res,
      message: "Password reset successfully!",
      data: {
        nextStep: "go to /login",
      },
    });
  };
};

export default resetPassword;
