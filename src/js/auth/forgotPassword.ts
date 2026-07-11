import type { ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import type { Request, Response } from "express";
import getModel from "./utils/getModel.js";
import createOTPUser from "./utils/createOTPUser.js";
import getUser from "./utils/getUser.js";

const forgotPassword = ({
  modelName,
  routeName,
  validationsObj,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // validate
    const body = validate(validationsObj.forgotPassword!, req.body);

    if (!req.body.email)
      throw new AppError({
        message:
          "collection error: email is required for forget password in validationsObj",
        statusCode: 409,
      });

    // user
    await getUser({
      modelName,
      routeName,
      email: body.email as string,
    });

    // send + create otp user
    await createOTPUser({
      body,
      res,
      purpose: "password_reset",
      routeName,
      modelName,
    });
  };
};

export default forgotPassword;
