import type { Request, Response } from "express";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import getValidationKey from "../utils/validationKeyError.js";
import { sanitizeOne } from "../utils/sanitize.js";

const remove = ({
  modelName,
  routeName,
  routeObj,
  validationsObj,
}: {
  modelName: string;
  routeObj: Route;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    getValidationKey(routeObj, validationsObj);

    // get /:parameter
    const id = getParam({ req, routeObj });

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      routeObj,
    });

    // authorize access
    authorizeAccess({ routeObj, routeName, item, req });

    // model
    const Model = getModel({ modelName, routeName, routeObj });

    // delete
    const deletedItem = await Model.findByIdAndDelete(id);

    // clean
    const cleaned = sanitizeOne(deletedItem!.toObject(), routeObj);

    // if '_id' excluded
    const idExcluded =
      routeObj.mongooseConfigObj?.hiddenFieldsArray?.includes("_id");
    if (idExcluded) delete cleaned["_id"];

    // return response
    appResponse({
      res,
      message: "Item deleted successfully!",
      statusCode: 202,
      data: cleaned
    });
  };
};

export default remove;
