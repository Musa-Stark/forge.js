import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import type { Request, Response } from "express";
import createOTPUser from "./utils/createOTPUser.js";
import getUser from "./utils/getUser.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { getEnvs } from "../config/envs.js";

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
    // get dynamic email and password
    const { authConfigObj } = getEnvs();
    const { fieldsObj } = authConfigObj;
    const emailKey = fieldsObj?.email;

    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if no email
    if (!req.body?.[emailKey!])
      throw new AppError({
        message: `${emailKey} is required.`,
        statusCode: 409,
        hint: `Provide your ${emailKey} for resetting password.`,
        details: getErrorDetail(routeObj),
      });

    // user
    await getUser({
      modelName,
      routeName,
      email: body[emailKey!] as string,
      routeObj,
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