import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import getParam from "./utils/getParam.js";
import type { Route, ValidationsObj } from "../types/Collection.js";
import getValidationKey from "../utils/validationKeyError.js";

const read = ({
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

    // get /:parameter
    const id = getParam({ req, route });

    // findById item
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      path: route.path,
      route
    });

    // return response
    appResponse({
      res,
      data: item,
      message: "Item found successfully!",
    });
  };
};
export default read;
