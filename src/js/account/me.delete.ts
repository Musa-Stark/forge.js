import type { Request, Response } from "express";
import getItem from "../crud/utils/getItem.js";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "../crud/utils/authorizeAccess.js";
import type { Route } from "../types/Collection.ts";
import { sanitizeOne } from "../utils/sanitize.js";
import { getEnvs } from "../config/envs.js";
import { findUser } from "../middleware/auth.middleware.js";

const remove = ({
  route,
  routeObj,
}: {
  routeObj: Route;
  route: string;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // user id
    const id = req.user._id;

    // user model
    const { userModelName } = getEnvs();
    const model = userModelName!;

    // ensure item exists
    const item = await findUser(id, routeObj, model)

    // authorize access
    authorizeAccess({ routeObj, route, item, req });

    // model
    const Model = getModel({ model, route, routeObj });

    // delete
    const deletedItem = await Model.findByIdAndDelete(id);

    // clean
    const cleaned = sanitizeOne(deletedItem!.toObject(), routeObj);

    // if '_id' excluded
    const idExcluded =
      routeObj.config?.hiddenFields?.includes("_id");
    if (idExcluded) delete cleaned["_id"];

    // return response
    appResponse({
      res,
      message: "Item deleted successfully!",
      statusCode: 202,
      data: cleaned,
    });
  };
};

export default remove;
