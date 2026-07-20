import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
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

    // find items
    const items = await getItem({ modelName, routeName, path: route.path, route });

    // return response
    appResponse({
      res,
      data: items,
      message: "Items found successfully!",
    });
  };
};
export default read;
