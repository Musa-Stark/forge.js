import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import modeMap from "./utils/modeMap.js";
import getModel from "../utils/getModel.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { getEnvs } from "../config/envs.js";

const signup = ({
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
    // get dynamic email and password
    const { authConfigObj } = getEnvs();
    const { fieldsObj } = authConfigObj;
    const emailKey = fieldsObj?.email;
    const passwordKey = fieldsObj?.password;

    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validation
    const body = validate(validationObj, req.body, routeObj);

    // if no email or password
    if (!req.body[emailKey!] || !req.body[passwordKey!])
      throw new AppError({
        message: `${emailKey} and ${passwordKey} are required.`,
        statusCode: 400,
        hint: `Provide ${emailKey} and ${passwordKey} in the request body.`,
        details: getErrorDetail(routeObj),
      });

    // if existing user
    const Model = getModel({ modelName, routeName, routeObj })!;

    const existing = await Model.findOne({
      [emailKey!]: body[emailKey!],
    });

    if (existing)
      throw new AppError({
        message: `User with this ${emailKey} already exists.`,
        statusCode: 409,
        hint: `Login with the existing account or use a different ${emailKey}.`,
        details: getErrorDetail(routeObj),
      });

    await modeMap.signup[routeObj.mode!]({
      body,
      res,
      routeName,
      modelName,
      purpose: "signup",
      routeObj,
      req,
    });
  };
};

export default signup;