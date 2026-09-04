import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import getParam from "./utils/getParam.js";
import type { Route, ValidationsObj } from "../types/Collection.js";
import authorizeAccess from "./utils/authorizeAccess.js";
import handleDecryption from "./encryption/handleDecryption.js";
import runActions from "./utils/runActions.js";

const read = ({
  model,
  route,
  routeObj,
}: {
  model: string;
  route: string;
  routeObj: Route;
  validations: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // get /:parameter
    const id = getParam({ req, routeObj });

    // runActions object
    const ActionObj = {
      req,
      user: req.user,
      route,
      model,
    };

    // before action
    let modifiedResponse = await runActions(routeObj.actions?.before, {
      operation: "read",
      ...ActionObj,
    });

    // findById item
    const item = await getItem({
      model,
      route,
      _id: id as string,
      path: routeObj.path,
      routeObj,
    });

    // if not public -> do authorizeAccess
    if (routeObj.auth !== "public")
      authorizeAccess({ routeObj, route, item, req });

    // if '_id' excluded
    const idExcluded = routeObj.config?.hiddenFields?.includes("_id");
    if (idExcluded) delete item["_id"];

    // if decryption
    const decryption = await handleDecryption(item, routeObj);

    // before action
    modifiedResponse = await runActions(routeObj.actions?.after, {
      operation: "read",
      ...ActionObj,
      data: {
        decrypted: decryption,
      },
    });

    // return response
    appResponse({
      res,
      data: modifiedResponse ?? { ...item, ...decryption },
      message: "Item found successfully!",
    });
  };
};
export default read;
