import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";

const update = ({
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
    // get /:parameter
    const id = getParam({ req, routeName, handler: "update" });

    // validate
    const body = validate(validationsObj.update, req.body);

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
    });

    // authorize access
    authorizeAccess({ item, req, route, routeName });

    // model
    const Model = getModel({ modelName, routeName });

    // update
    const updatedItem = await Model.findByIdAndUpdate(id, body, {
      returnDocument: "after",
    });

    // return response
    appResponse({
      res,
      data: sanitizeOne(updatedItem!.toObject()),
      message: "Item updated successfully!",
    });
  };
};

export default update;
