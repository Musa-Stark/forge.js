import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { sanitizeItem } from "../../utils/sanitize.js";
import mongoose from "mongoose";
import { hash } from "../../utils/libsodium.js";
import getModel from "./getModel.js";
import getOTPModel from "./getOTPModel.js";
import handleIsVerified from "./handleIsVerfieid.js";

const createUser = async ({
  body,
  modelName,
  res,
  routeName,
}: {
  body: any;
  modelName: string;
  res: Response;
  routeName: string;
}) => {
  const Model = getModel({ modelName, routeName });
  const OTPModel = getOTPModel();

  // isVerified - mode:otp
  let isVerified: boolean = false;
  let isOTPUser: any = null;
  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified(body.email as string));

  // delete body._id | hash password
  if (body instanceof mongoose.Document) {
    body = body.toObject();
    delete body._id;
  } else {
    body.password = await hash(body.password);
  }

  // new user
  const newUser = await Model.create(body);
  // if from otp, remove it
  if (isVerified) await OTPModel.deleteOne({ _id: isOTPUser._id });

  // send res
  appResponse({
    res,
    message: "Your account has been created successfully!",
    statusCode: 201,
    data: sanitizeItem(newUser.toObject()),
  });
};

export default createUser;
