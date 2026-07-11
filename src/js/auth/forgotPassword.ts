import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import type { Request, Response } from "express";
import registerModel from "../lib/model.registry.js";

const forgotPassword = ({
  modelName,
  route,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    if (!modelName)
      throw new AppError({
        message: `modelName for ${route} route is required`,
        statusCode: 404,
      });

    // validate
    const body = validate(validationsObj.forgotPassword!, req.body);
    const Model = registerModel[modelName]!;

  };
};

export default forgotPassword;
