/*
1. in auth/index.ts - validation of mongooseOTPSchemaObj
2. userData ->
    a. mode: otp -> message: otp sent successfully
    b. mode: credentials -> message: account created successfully + cookie + userdata
*/

import type { ValidationsObj } from "../types/ValidationsObj.ts";
import type { Request, Response } from "express";
import registerModel from "../lib/model.registry.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import appResponse from "../utils/response.js";

const signup = (modelName: string, validationsObj?: ValidationsObj) => {
  return async (req: Request, res: Response) => {
    // validation
    const body = validate(validationsObj!.signup, req.body);
    const Model = registerModel[modelName];

    // existing user
    const existingUser = await Model?.findOne({ email: body.email });
    if (existingUser)
      throw new AppError({ message: "User already exists", statusCode: 409 });

    // new user
    const newUser = await Model?.create(body);

    // success - response
    appResponse({
      res,
      message: "Account created successfully!",
      statusCode: 301,
      data: newUser,
    });
  };
};

export default signup;