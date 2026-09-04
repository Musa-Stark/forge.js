import type { Request, Response } from "express";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authorizeAccess.js";
import type { Route } from "../types/Collection.ts";
import { sanitizeOne } from "../utils/sanitize.js";
import runActions from "./utils/runActions.js";

const remove = ({
  model,
  route,
  routeObj,
}: {
  model: string;
  routeObj: Route;
  route: string;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // get /:parameter
    const id = getParam({ req, routeObj });

    // ensure item exists
    const item = await getItem({
      model,
      route,
      _id: id as string,
      routeObj,
    });

    // authorize access
    authorizeAccess({ routeObj, route, item, req });

    // model
    const Model = getModel({ model, route, routeObj });

    // runActions object
    const ActionObj = {
      req,
      user: req.user,
      route,
      model,
      Model,
    };

    // before action
    let modifiedResponse = await runActions(routeObj.actions?.before, {
      operation: "remove",
      ...ActionObj,
    });

    // delete
    const deletedItem = await Model.findByIdAndDelete(id);

    // clean
    const cleaned = sanitizeOne(deletedItem!.toObject(), routeObj);

    // if '_id' excluded
    const idExcluded =
      routeObj.config?.hiddenFields?.includes("_id");
    if (idExcluded) delete cleaned["_id"];

    // after action
    modifiedResponse = await runActions(routeObj.actions?.after, {
      ...ActionObj,
      operation: "remove",
      item: cleaned,
    });

    // return response
    appResponse({
      res,
      message: "Item deleted successfully!",
      statusCode: 202,
      data: modifiedResponse ?? cleaned,
    });
  };
};

export default remove;
