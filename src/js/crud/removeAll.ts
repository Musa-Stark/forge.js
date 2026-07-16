import type { Request, Response, Router } from "express";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import type { Route } from "../types/Collection.ts";

const removeAll = ({
  modelName,
  routeName,
  route,
}: {
  modelName: string;
  routeName: string;
  route: Route
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // authorize access
    authorizeAccess({route, routeName, req})

    // model
    const Model = getModel({ modelName, routeName });

    // delete all
    const result = await Model.deleteMany({});

    // return response
    appResponse({
      res,
      data: {
        deletedCount: result.deletedCount,
      },
      message: "Items deleted successfully!",
      statusCode: 204
    });
  };
};

export default removeAll;