import type { Request, Response } from "express";
import getModel from "../utils/getModel.js";
import appResponse from "../utils/response.js";

const removeAll = ({
  modelName,
  routeName,
}: {
  modelName: string;
  routeName: string;
}) => {
  return async (_req: Request, res: Response): Promise<void> => {
    // model
    const Model = getModel({ modelName, routeName });

    // delete all
    const result = await Model.deleteMany({});

    // return response
    appResponse({
      res,
      data: {
        deletedCount: result.deletedCount,
      },
      message: "Items deleted successfully!",
    });
  };
};

export default removeAll;