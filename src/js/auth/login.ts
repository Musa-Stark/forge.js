import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import modeMap from "./utils/modeMap.js";
import validate from "../utils/validate.js";

const login = ({
  modelName,
  route,
  routeName,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  routeName: string,
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    const body = validate(validationsObj.login, req.body);

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
