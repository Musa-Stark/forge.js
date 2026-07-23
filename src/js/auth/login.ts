import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import modeMap from "./utils/modeMap.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";


const login = ({
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

    // if no email or password in validation
    if (!req.body.email || !req.body.password)
      throw new AppError({
         message: "Email and password are required",
        statusCode: 409,
        code: "AUTH_CONFIGURATION_INVALID",
        hint: 'Provide email and password to login',
        details: getErrorDetail(route),
      });

    await modeMap.login[route.mode!]({
      body,
      res,
      purpose: "login",
      routeName,
      modelName,
      route
    });
  };
};

export default login;
