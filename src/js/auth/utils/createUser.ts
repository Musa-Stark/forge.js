import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { sanitizeOne } from "../../utils/sanitize.js";
import mongoose from "mongoose";
import { hash } from "../../utils/libsodium.js";
import getModel from "../../utils/getModel.js";
import getOTPModel from "./getOTPModel.js";
import handleIsVerified from "./handleIsVerified.js";
import { sendCookie } from "./sendCookie.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";

const createUser = async ({
  body,
  modelName,
  res,
  routeName,
  routeObj,
}: {
  body: any;
  modelName: string;
  res: Response;
  routeName: string;
  routeObj: Route;
}) => {
  // models
  const Model = getModel({ modelName, routeName, routeObj });
  const OTPModel = getOTPModel(routeObj);

  // returnAccessToken
  const { authConfigObj } = getEnvs();

  // isVerified - mode:otp
  let isVerified: boolean = false;
  let isOTPUser: any = null;
  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified({
      email: body.email as string,
      purpose: "signup",
      routeObj,
    }));

  // delete body._id | hash password
  if (body instanceof mongoose.Document) {
    body = body.toObject();
    body.role = "user";
    delete body._id;
  } else {
    body.password = await hash(body.password, routeObj);
    body.role = "user";
  }

  // new user
  const newUser = await Model.create(body);

  // if from otp, remove it
  if (isVerified) await OTPModel.deleteOne({ _id: isOTPUser._id });

  const { _id } = newUser.toObject();

  // send cookied
  const token = sendCookie({
    res,
    cookieName: "authToken",
    payload: { sub: _id },
    routeObj,
  });

  // send res
  appResponse({
    res,
    message: "Your account has been created successfully!",
    statusCode: 201,
    data: sanitizeOne(newUser.toObject(), routeObj),
    accessToken: authConfigObj?.returnAccessToken ? token : undefined,
    purpose: body.purpose
  });
};

export default createUser;
