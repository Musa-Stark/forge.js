import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import modeMap from "./utils/modeMap.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";


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
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if no email or password in validation
    if (!req.body.email || !req.body.password)
      throw new AppError({
         message: "Email and password are required",
        statusCode: 409,
        code: "AUTH_CONFIGURATION_INVALID",
        hint: 'Provide email and password to login',
        details: getErrorDetail(routeObj),
      });

    await modeMap.login[routeObj.mode!]({
      body,
      res,
      purpose: "login",
      routeName,
      modelName,
      routeObj
    });
  };
};

export default login;
