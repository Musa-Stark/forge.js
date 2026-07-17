import type { Request, Response, Router } from "express";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import getValidationKey from "../utils/validationKeyError.js";

const removeAll = ({
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
    // validationObj
    getValidationKey(route, validationsObj);

    // authorize access
    authorizeAccess({ route, routeName, req });

    // model
    const Model = getModel({ modelName, routeName });

    // delete all
    const result = await Model.deleteMany({});

    // if item(s) not found
    const notFound = !result || result.deletedCount === 0;

    if (notFound) {
      throw new AppError({
        message: `Data not found for route: /${routeName}`,
        statusCode: 404,
        data: {
          nextStep: "Hit a POST request and insert an item",
        },
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
