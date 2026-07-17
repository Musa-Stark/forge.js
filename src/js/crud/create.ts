import type { ErrorRequestHandler, Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.js";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import { MongoServerError } from "mongodb";
import handleUploadFiles from "../upload/index.js";

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

    // if files
    const avatar = await handleUploadFiles(req, route);

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
    let newItem = null;
    try {
      newItem = await Model.create({ owner: req.user._id, avatar, ...body });
    } catch (err) {
      // err as Error
      const e = err as Error;

      // if duplicate key error
      if (e.name === "MongoServerError") {
        const field = Object.keys((err as MongoServerError).keyPattern)[0];
        throw new AppError({
          message: `Item with this '${field}' already exists`,
          statusCode: 409,
        });
      }

      // throw e.message
      throw new AppError({ message: e.message, statusCode: 409 });
    }

    // appresponse
    appResponse({
      res,
      data: sanitizeOne(newItem.toObject()),
      message: "Item created successfully!",
    });
  };
};

export default create;
