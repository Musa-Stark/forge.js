import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import modeMap from "./utils/modeMap.js";
import registerModel from "../lib/model.registry.js";

const signup = ({
  modelName,
  route,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  validationsObj?: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    if (!modelName)
      throw new AppError({
        message: `modelName for ${route} route is required`,
        statusCode: 404,
      });

    // validation
    const body = validate(validationsObj!.signup, req.body);

    // if existing user
    const Model = registerModel[modelName];
    const existing = await Model?.findOne({ email: body.email });
    if (existing)
      throw new AppError({
        message: `User with this email already exists`,
        statusCode: 409,
      });

    await modeMap.signup[route.mode!]({
      body,
      res,
      modelName,
      purpose: "signup",
    });
  };
};

export default signup;
