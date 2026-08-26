import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import modeMap from "./utils/modeMap.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { getEnvs } from "../config/envs.js";

const login = ({
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

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if no email or password in validation
    if (!req.body?.[emailKey!] || !req.body?.[passwordKey!])
      throw new AppError({
        message: `${emailKey} and ${passwordKey} are required.`,
        statusCode: 409,
        hint: `Provide ${emailKey} and ${passwordKey} to login.`,
        details: getErrorDetail(routeObj),
      });

    await modeMap.login[routeObj.mode!]({
      body,
      res,
      purpose: "login",
      routeName,
      modelName,
      routeObj,
      req,
    });
  };
};

export default login;