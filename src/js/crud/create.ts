import type { ErrorRequestHandler, Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.js";
import AppError from "../utils/AppError.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import { MongoServerError } from "mongodb";
import { handleUploadFiles } from "../upload/index.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";


const create = ({
  modelName,
  routeName,
  routeObj,
  validationsObj,
}: {
  modelName: string;
  routeName: string;
  routeObj: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if files
    const fileMetaData = await handleUploadFiles(req, routeObj);

    // model
    const Model = getModel({ modelName, routeName, routeObj });

    // owner
    const owner = req.user?._id;
    if (!owner)
      throw new AppError({
        message: "authRole should'nt be public",
        statusCode: 409,
        hint: "Make the authRole admin or adminOrOwner",
        details: getErrorDetail(routeObj),
      });

    // create
    let newItem = null;
    try {
      newItem = await Model.create({
        owner: req.user._id,
        ...fileMetaData,
        ...body,
      });
    } catch (err) {
      // err as Error
      const e = err as Error;

      // if duplicate key error
      if (e.name === "MongoServerError") {
        const field = Object.keys((err as MongoServerError).keyPattern)[0];
        throw new AppError({
          message: `Item with this '${field}' already exists`,
          statusCode: 409,
          hint: `'${field}' is declared as unique in collection -> mongooseSchemaObj`,
          details: {
            handler: routeObj.handler,
            method: routeObj.method,
            path: routeObj.path,
          },
        });
      }

      // throw e.message
      throw new AppError({
        message: e.message,
        statusCode: 409,
        hint: "This issue may requires a fix from the framework developer.",
        details: getErrorDetail(routeObj),
      });
    }

    // appresponse
    appResponse({
      res,
      data: sanitizeOne(newItem.toObject(), routeObj),
      message: "Item created successfully!",
    });
  };
};

export default create;
