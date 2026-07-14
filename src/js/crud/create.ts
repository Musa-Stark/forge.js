import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.js";
import getItem from "./utils/getItem.js";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";

const create = ({
  modelName,
  routeName,
  route,
  validationsObj,
}: {
  modelName: string;
  routeName: string;
  route: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validate
    const body = validate(validationsObj.create, req.body);

    // model
    const Model = getModel({ modelName, routeName });

    // owner
    const owner = req.user?._id;
    if (!owner)
      throw new AppError({
        message: `authRole should'nt be public for route: '/${routeName}', method: '${route.method}' and path: '${route.path}'`,
        statusCode: 409,
      });

    // create
    const newItem = await Model.create({ owner: req.user._id, ...body });

    // appresponse
    appResponse({
      res,
      data: sanitizeOne(newItem.toObject()),
      message: "Item created successfully!",
    });
  };
};

export default create;
