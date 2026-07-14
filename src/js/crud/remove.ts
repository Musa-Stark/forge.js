import type { Request, Response } from "express";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";

const remove = ({
  modelName,
  routeName,
}: {
  modelName: string;
  routeName: string;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // get /:parameter
    const id = getParam({ req, routeName, handler: "remove" });

    // ensure item exists
    await getItem({
      modelName,
      routeName,
      _id: id as string,
    });

    // model
    const Model = getModel({ modelName, routeName });

    // delete
    await Model.findByIdAndDelete(id);

    // return response
    appResponse({
      res,
      message: "Item deleted successfully!",
    });
  };
};

export default remove;