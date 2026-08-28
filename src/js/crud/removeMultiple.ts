import type { Request, Response, Router } from "express";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import validate from "../utils/validate.js";

const removeAll = ({
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

    // authorize access

    // model
    const Model = getModel({ modelName, routeName, routeObj });

    // body
    const body = validate(validationObj, req.body, routeObj);

    // ids - field name
    const idsFieldName = routeObj.mongooseConfigObj?.removeMultipleFieldKey;
    if (!idsFieldName)
      throw new AppError({
        details: getErrorDetail(routeObj),
        hint: "Write the array name in routes -> route -> mongooseConfigObj -> removeMultipleFieldKey that has items' ids to delete",
        message: "Ids field name missing",
        statusCode: 409,
      });

    // delete all
    const result = await Model.deleteMany({
      _id: { $in: body[idsFieldName] },
      owner: req.user._id,
    });

    // if item(s) not found
    const notFound = !result || result.deletedCount === 0;

    if (notFound) {
      throw new AppError({
        message: `Data not found to delete`,
        statusCode: 404,
        hint: `Make sure you ids array name: '${idsFieldName}' is correct. Hit a POST request to insert an item.`,
        details: getErrorDetail(routeObj),
      });
    }

    // return response
    appResponse({
      res,
      data: {
        deletedCount: result.deletedCount,
      },
      message: "Items deleted successfully!",
      statusCode: 202,
    });
  };
};

export default removeAll;
