import AppError from "../../utils/AppError.js";
import registerModel from "../../lib/model.registry.js";
import type { Response } from "express";
import appResponse from "../../utils/response.js";

const createUser = async ({
  body,
  modelName,
  res,
}: {
  body: any;
  modelName: string;
  res: Response;
}) => {
  const Model = registerModel[modelName];
  if (!Model)
    throw new AppError({
      message: `Model: ${modelName} not found to create user`,
      statusCode: 404,
    });

  const existing = await Model.findOne({ email: body.email });
  if (existing)
    throw new AppError({
      message: `User with '${body.email}' email already exists`,
      statusCode: 409,
    });

  const newUser = await Model.create(body);

  appResponse({
    res,
    message: "Account created successfully!",
    statusCode: 301,
    data: newUser,
  });
};

export default createUser;
