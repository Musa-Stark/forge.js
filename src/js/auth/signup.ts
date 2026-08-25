import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import modeMap from "./utils/modeMap.js";
import getModel from "../utils/getModel.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";


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
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validation
    const body = validate(validationObj, req.body, routeObj);

    // if no email or password
    if (!req.body.email || !req.body.password)
      throw new AppError({
        message: "email and password are required.",
        statusCode: 400,
        hint: "Provide email and password in the request body.",
        details: getErrorDetail(routeObj),
      });

    // if existing user
    const Model = getModel({ modelName, routeName, routeObj })!;

    const existing = await Model.findOne({ email: body.email });

    if (existing)
      throw new AppError({
        message: "User with this email already exists.",
        statusCode: 409,
        hint: "Login with the existing account or use a different email address.",
        details: getErrorDetail(routeObj),
      });

    await modeMap.signup[routeObj.mode!]({
      body,
      res,
      routeName,
      modelName,
      purpose: "signup",
      routeObj,
      req
    });
  };
};

export default signup;