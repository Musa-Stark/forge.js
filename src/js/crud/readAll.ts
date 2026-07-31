import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import type { Route, ValidationsObj } from "../types/Collection.js";
import getValidationKey from "../utils/validationKeyError.js";
import authorizeAccess from "./utils/authroizeAccess.js";

const read = ({
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
    // find items
    const items = await getItem({
      modelName,
      routeName,
      path: routeObj.path,
      routeObj,
    });

    if (routeObj.authRole !== "public")
      authorizeAccess({ routeObj, routeName, item: items[0], req });

    // return response
    appResponse({
      res,
      data: items,
      message: "Items found successfully!",
    });
  };
};
export default read;
