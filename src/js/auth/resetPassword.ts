import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import getOTPUser from "./utils/getOTPUser.js";
import handleIsVerified from "./utils/handleIsVerified.js";
import getUser from "./utils/getUser.js";
import { hash } from "../utils/libsodium.js";
import getOTPModel from "./utils/getOTPModel.js";
import appResponse from "../utils/response.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { getEnvs } from "../config/envs.js";

const resetPassword = ({
  model,
  routeObj,
  route,
  validations,
}: {
  model: string;
  routeObj: Route;
  route: string;
  validations: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // get dynamic auth field keys
    const { authConfigObj } = getEnvs();
    const { fieldsObj } = authConfigObj;

    const emailKey = fieldsObj?.email;
    const passwordKey = fieldsObj?.password;
    const otpKey = fieldsObj?.otp;
    const purposeKey = fieldsObj?.purpose;

    // validationObj
    const validationObj = getValidationKey(routeObj, validations);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if no email or password in request
    if (!req.body?.[emailKey!] || !req.body?.[passwordKey!])
      throw new AppError({
        message: `${emailKey} and ${passwordKey} are required.`,
        statusCode: 400,
        hint: `Provide ${emailKey} and ${passwordKey} in the request body.`,
        details: getErrorDetail(routeObj),
      });

    // password reset purpose
    const purpose = "password_reset";

    // OTPUser
    await getOTPUser({
      email: body[emailKey!] as string,
      purpose,
      routeObj,
    });

    // handle is verified or not
    const { isVerified } = await handleIsVerified({
      email: body[emailKey!] as string,
      purpose,
      routeObj,
    });

    // user
    const user = await getUser({
      model,
      route,
      email: body[emailKey!] as string,
      routeObj,
    });

    // update password
    user[passwordKey!] = await hash(
      body[passwordKey!] as string,
      routeObj
    );

    // save user
    await user.save();

    const OTPModel = getOTPModel(routeObj);

    if (isVerified)
      await OTPModel.deleteOne({
        [emailKey!]: body[emailKey!] as string,
        [purposeKey!]: purpose,
      });

    appResponse({
      res,
      message: "Password reset successfully!",
      data: {
        nextStep: "go to /login",
      },
    });
  };
};

export default resetPassword;