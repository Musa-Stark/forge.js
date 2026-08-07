import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import type { Request, Response } from "express";
import createOTPUser from "./utils/createOTPUser.js";
import getUser from "./utils/getUser.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";

const forgotPassword = ({
  modelName,
  routeName,
  validationsObj,
  routeObj,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
  routeObj: Route;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    if (!req.body.email)
      throw new AppError({
        message: "Email is required",
        statusCode: 409,
        hint: 'Provide email your email for resetting password',
        details: getErrorDetail(routeObj),
      });

    // user
    await getUser({
      modelName,
      routeName,
      email: body.email as string,
      routeObj
    });

    // send + create otp user
    await createOTPUser({
      body,
      res,
      purpose: "password_reset",
      routeName,
      modelName,
      routeObj,
    });
  };
};

export default forgotPassword;
