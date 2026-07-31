import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import getValidationKey from "../utils/validationKeyError.js";

const update = ({
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
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // get /:parameter
    const id = getParam({ req, routeObj });

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      routeObj
    });

    // authorize access
    authorizeAccess({ item, req, routeObj, routeName });

    // model
    const Model = getModel({ modelName, routeName, routeObj });

    // update
    const updatedItem = await Model.findByIdAndUpdate(id, body, {
      returnDocument: "after",
    });

    // return response
    appResponse({
      res,
      data: sanitizeOne(updatedItem!.toObject(), routeObj),
      message: "Item updated successfully!",
    });
  };
};

export default update;
