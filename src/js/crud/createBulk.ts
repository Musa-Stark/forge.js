import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeMany } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import getValidationKey from "../utils/validationKeyError.js";

const createBulk = ({
  modelName,
  routeName,
  validationsObj,
  route,
}: {
  modelName: string;
  routeName: string;
  route: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(route, validationsObj, route);

    // validate
    const body = validate(validationObj, req.body);

    // model
    const Model = getModel({ modelName, routeName });

    // create
    const newItems = await Model.insertMany(body);

    // return response
    appResponse({
      res,
      data: sanitizeMany(newItems),
      message: "Items created successfully!",
    });
  };
};

export default createBulk;
