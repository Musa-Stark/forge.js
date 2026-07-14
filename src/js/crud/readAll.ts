import type { Request, Response } from "express";
import getItem from "./utils/getItem.js";
import appResponse from "../utils/response.js";
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
    // find items
    const items = await getItem({ modelName, routeName, path: route.path });

    // return response
    appResponse({
      res,
      data: items,
      message: "Items found successfully!",
    });
  };
};
export default read;
