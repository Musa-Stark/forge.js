import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import modeMap from "./utils/modeMap.js";
import getModel from "./utils/getModel.js";

const signup = ({
  modelName,
  route,
  routeName,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  routeName: string;
  validationsObj?: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // validation
    const body = validate(validationsObj!.signup, req.body);

    // if existing user
    const Model = getModel({ modelName, routeName })!;
    const existing = await Model?.findOne({ email: body.email });
    if (existing)
      throw new AppError({
        message: `User with this email already exists`,
        statusCode: 409,
      });

    await modeMap.signup[route.mode!]({
      body,
      res,
      routeName,
      modelName,
      purpose: "signup",
    });
  };
};

export default signup;
