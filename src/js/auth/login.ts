import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import modeMap from "./utils/modeMap.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";

const login = ({
  modelName,
  route,
  routeName,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // validate
    const body = validate(validationsObj.login, req.body);

    // if no email or password in validation
    if (!req.body.email || !req.body.password)
      throw new AppError({
        message:
          "collection error: email and password are required to login in validationsObj",
        statusCode: 409,
      });

    await modeMap.login[route.mode!]({
      body,
      res,
      purpose: "login",
      routeName,
      modelName,
    });
  };
};

export default login;
