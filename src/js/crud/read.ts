import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import getParam from "./utils/getParam.js";
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
    // get /:parameter
    const id = getParam({ req, routeObj });

    // findById item
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      path: routeObj.path,
      routeObj,
    });

    if (routeObj.authRole !== "public")
      authorizeAccess({ routeObj, routeName, item, req });

    // return response
    appResponse({
      res,
      data: item,
      message: "Item found successfully!",
    });
  };
};
export default read;
