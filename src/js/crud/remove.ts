import type { Request, Response } from "express";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import getValidationKey from "../utils/validationKeyError.js";

const remove = ({
  modelName,
  routeName,
  route,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    getValidationKey(route, validationsObj);

    // get /:parameter
    const id = getParam({ req, route });

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      route
    });

    // authorize access
    authorizeAccess({ route, routeName, item, req });

    // model
    const Model = getModel({ modelName, routeName, route });

    // delete
    await Model.findByIdAndDelete(id);

    // return response
    appResponse({
      res,
      message: "Item deleted successfully!",
      statusCode: 202,
    });
  };
};

export default remove;
