import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeMany } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import getValidationKey from "../utils/validationKeyError.js";

const createBulk = ({
  model,
  route,
  validations,
  routeObj,
}: {
  model: string;
  route: string;
  routeObj: Route;
  validations: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validations);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // model
    const Model = getModel({ model, route, routeObj });

    // create
    const newItems = await Model.insertMany(body);

    // return response
    appResponse({
      res,
      data: sanitizeMany(newItems, routeObj),
      message: "Items created successfully!",
    });
  };
};

export default createBulk;
