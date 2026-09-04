import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import type { Route } from "../types/Collection.js";
import authorizeAccess from "./utils/authorizeAccess.js";
import runActions from "./utils/runActions.js";
import handleDecryption from "./encryption/handleDecryption.js";

const read = ({
  model,
  route,
  routeObj,
}: {
  model: string;
  route: string;
  routeObj: Route;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // runActions object
    const ActionObj = {
      req,
      user: req.user,
      route,
      model,
    };

    // before action
    let modifiedResponse = await runActions(routeObj.actions?.before, {
      operation: "readAll",
      ...ActionObj,
    });

    // Find item
    const items = await getItem({
      model,
      route,
      path: routeObj.path,
      routeObj,
    });

    // If not public -> authorize access
    if (routeObj.auth !== "public") {
      authorizeAccess({
        routeObj,
        route,
        item: items[0],
        req,
      });
    }
    // if '_id' excluded
    const idExcluded =
      routeObj.config?.hiddenFields?.includes("_id");

    // Decrypt fields
    const decryptedItems = await Promise.all(
      items.map(async (item: any) => {
        if (idExcluded) delete item["_id"];

        const decryption = await handleDecryption(item, routeObj);

        return {
          ...item,
          ...decryption,
        };
      }),
    );

    // before action
    modifiedResponse = await runActions(routeObj.actions?.after, {
      operation: "readAll",
      ...ActionObj,
      item: decryptedItems,
      result: decryptedItems,
    });

    // Return response
    appResponse({
      res,
      data: modifiedResponse ?? decryptedItems,
      message: "Items found successfully!",
    });
  };
};

export default read;
