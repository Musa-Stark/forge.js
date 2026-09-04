import type { Request, Response, Router } from "express";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import validate from "../utils/validate.js";
import runActions from "./utils/runActions.js";

const removeMultiple = ({
  model,
  route,
  routeObj,
  validations,
}: {
  model: string;
  route: string;
  routeObj: Route;
  validations: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validations);

    // authorize access

    // model
    const Model = getModel({ model, route, routeObj });

    // runActions object
    const ActionObj = {
      req,
      user: req.user,
      route,
      model,
      Model,
    };

    // before action
    let modifiedResponse = await runActions(routeObj.actions?.before, {
      operation: "removeMultiple",
      ...ActionObj,
    });

    // body
    const body = validate(validationObj, req.body, routeObj);

    // ids - field name
    const idsFieldName = routeObj.config?.targetField;
    if (!idsFieldName)
      throw new AppError({
        details: getErrorDetail(routeObj),
        hint: "Write the array name in routes -> route -> config -> targetField that has items' ids to delete",
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

    // after action
    modifiedResponse = await runActions(routeObj.actions?.before, {
      operation: "removeMultiple",
      ...ActionObj,
      item: result,
    });

    // return response
    appResponse({
      res,
      data: modifiedResponse ?? {
        deletedCount: result.deletedCount,
      },
      message: "Items deleted successfully!",
      statusCode: 202,
    });
  };
};

export default removeMultiple;
