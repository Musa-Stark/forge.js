import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import modeMap from "./utils/modeMap.js";
import getModel from "../utils/getModel.js";
import getValidationKey from "../utils/validationKeyError.js";

const signup = ({
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

    // validation
    const body = validate(validationObj, req.body, route);

    // if no email or password
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

    // if existing user
    const Model = getModel({ modelName, routeName, route })!;

    const existing = await Model.findOne({ email: body.email });

    if (existing)
      throw new AppError({
        message: "User with this email already exists.",
        statusCode: 409,
        code: "AUTH_EMAIL_ALREADY_EXISTS",
        hint: "Login with the existing account or use a different email address.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    await modeMap.signup[route.mode!]({
      body,
      res,
      routeName,
      modelName,
      purpose: "signup",
      route
    });
  };
};

export default signup;