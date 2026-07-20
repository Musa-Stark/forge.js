import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import type { Request, Response } from "express";
import createOTPUser from "./utils/createOTPUser.js";
import getUser from "./utils/getUser.js";
import getValidationKey from "../utils/validationKeyError.js";

const forgotPassword = ({
  modelName,
  routeName,
  validationsObj,
  route,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
  route: Route;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(route, validationsObj);

    // validate
    const body = validate(validationObj, req.body, route);

    if (!req.body.email)
      throw new AppError({
        message: "Email is required",
        statusCode: 409,
        code: "AUTH_CONFIGURATION_INVALID",
        hint: 'Provide email your email for resetting password',
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // user
    await getUser({
      modelName,
      routeName,
      email: body.email as string,
      route
    });

    // send + create otp user
    await createOTPUser({
      body,
      res,
      purpose: "password_reset",
      routeName,
      modelName,
      route,
    });
  };
};

export default forgotPassword;
