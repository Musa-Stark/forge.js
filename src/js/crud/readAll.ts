import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import type { Route, ValidationsObj } from "../types/Collection.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import handleDecryption from "./encryption/handleDecryption.js";

const read = ({
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
    // Find item
    const items = await getItem({
      modelName,
      routeName,
      path: routeObj.path,
      routeObj,
    });

    // If not public -> authorize access
    if (routeObj.authRole !== "public") {
      authorizeAccess({
        routeObj,
        routeName,
        item: items[0],
        req,
      });
    }
    // if '_id' excluded
    const idExcluded =
      routeObj.mongooseConfigObj?.hiddenFieldsArray?.includes("_id");

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

    // Return response
    appResponse({
      res,
      data: decryptedItems,
      message: "Items found successfully!",
    });
  };
};

export default read;
