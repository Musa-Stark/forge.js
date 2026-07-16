import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
import getParam from "./utils/getParam.js";
import type { Route } from "../types/Collection.js";

const read = ({
  modelName,
  routeName,
  route,
}: {
  modelName: string;
  routeName: string;
  route: Route;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // get /:parameter
    const id = getParam({ req, routeName, handler: "read" });

    // findById item
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      path: route.path,
    });

    // return response
    appResponse({
      res,
      data: item,
      message: "Item found successfully!",
    });
  };
};
export default read;
