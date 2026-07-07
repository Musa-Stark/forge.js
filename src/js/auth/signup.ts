import type { ValidationsObj } from "../types/ValidationsObj.ts";
import type { Request, Response } from "express";
import type { Route } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import createOTPUser from "./utils/createOTPUser.js";
import createUser from "./utils/createUser.js";

const modeMap = {
  otp: createOTPUser,
  credentials: createUser,
};

const signup = (
  modelName: string,
  route: Route,
  validationsObj?: ValidationsObj,
) => {
  return async (req: Request, res: Response) => {
    // validation
    const body = validate(validationsObj!.signup, req.body);
    if (!modelName)
      throw new AppError({
        message: `modelName for ${route} route is required`,
        statusCode: 404,
      });

    await modeMap[route.mode!]({ body, res, modelName });
  };
};

export default signup;
