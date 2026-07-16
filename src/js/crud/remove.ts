import type { Request, Response } from "express";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import type { Route } from "../types/Collection.ts"; 

const remove = ({
  modelName,
  routeName,
  route,
}: {
  modelName: string;
  route: Route,
  routeName: string;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // get /:parameter
    const id = getParam({ req, routeName, handler: "remove" });

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
    });

    // authorize access
    authorizeAccess({ route, routeName, item, req });

    // model
    const Model = getModel({ modelName, routeName });

    // delete
    await Model.findByIdAndDelete(id);

    // return response
    appResponse({
      res,
      message: "Item deleted successfully!",
      statusCode: 204
    });
  };
};

export default remove;
