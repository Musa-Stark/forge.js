import type { Request, Response } from "express";
import type { ValidationsObj } from "../types/Collection.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeMany } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";

const createBulk = ({
  modelName,
  routeName,
  validationsObj,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validate
    const body = validate(validationsObj.createBulk, req.body);

    // model
    const Model = getModel({ modelName, routeName });

    // create
    const newItems = await Model.insertMany(body);

    // return response
    appResponse({
      res,
      data: sanitizeMany(newItems),
      message: "Items created successfully!",
    });
  };
};

export default createBulk;