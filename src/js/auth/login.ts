import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import modeMap from "./utils/modeMap.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";

const login = ({
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

    const body = validate(validationsObj.login, req.body);

    await modeMap.login[route.mode!]({
      body,
      res,
      purpose: "login",
      modelName,
    });
  };
};

export default login;