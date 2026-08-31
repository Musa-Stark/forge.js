import type { Request, Response, Router } from "express";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authorizeAccess.js";
import type { Route } from "../types/Collection.ts";
import AppError from "../utils/AppError.js";
import getErrorDetail from "../utils/getErrorDetail.js";


const removeAll = ({
  modelName,
  routeName,
  routeObj,
}: {
  modelName: string;
  routeName: string;
  routeObj: Route;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // authorize access
    authorizeAccess({ routeObj, routeName, req });

    // model
    const Model = getModel({ modelName, routeName, routeObj });

    // delete all
    const result = await Model.deleteMany({});

    // if item(s) not found
    const notFound = !result || result.deletedCount === 0;

    if (notFound) {
      throw new AppError({
        message: `Data not found to delete`,
        statusCode: 404,
        hint: "Hit a POST request to insert an item",
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
