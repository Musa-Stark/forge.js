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
import getErrorDetail from "../utils/getErrorDetail.js";


const resetPassword = ({
  modelName,
  routeObj,
  routeName,
  validationsObj,
}: {
  modelName: string;
  routeObj: Route;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if no email or password in request
    if (!req.body.email || !req.body.password)
      throw new AppError({
        message: "email and password are required.",
        statusCode: 400,
        hint: "Provide email and password in the request body.",
        details: getErrorDetail(routeObj),
      });

    // OTPUser
    await getOTPUser({
      email: body.email as string,
      purpose: "password_reset",
      routeObj,
    });

    // handle is verified or not
    const { isVerified } = await handleIsVerified({
      email: body.email as string,
      purpose: "password_reset",
      routeObj
    });

    // user
    const user = await getUser({
      modelName,
      routeName,
      email: body.email as string,
      routeObj
    });

    // update password
    user.password = await hash(body.password as string, routeObj);

    // save user
    await user.save();

    const OTPModel = getOTPModel(routeObj);

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
