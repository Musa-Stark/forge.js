import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authroizeAccess.js";
import getValidationKey from "../utils/validationKeyError.js";
import handleEncryption from "./encryption/handleEncryption.js";
import handleHashing from "./security/handleHashing.js";

const update = ({
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
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // get /:parameter
    const id = getParam({ req, routeObj });

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id as string,
      routeObj,
    });

    // authorize access
    authorizeAccess({ item, req, routeObj, routeName });

    // if encryptedFields
    const encryptedFields = await handleEncryption(req.body, routeObj);

    // if hashedFields
    const hashedFields = await handleHashing(req.body, routeObj);

    // model
    const Model = getModel({ modelName, routeName, routeObj });

    // update
    const updatedItem = await Model.findByIdAndUpdate(
      id,
      { ...body, encryptedFields, hashedFields },
      {
        returnDocument: "after",
      },
    );

    // if '_id' excluded
    const idExcluded =
      routeObj.mongooseConfigObj?.hiddenFieldsArray?.includes("_id");
    if (idExcluded) delete updatedItem["_id"];

    // return response
    appResponse({
      res,
      data: sanitizeOne(updatedItem!.toObject(), routeObj),
      message: "Item updated successfully!",
    });
  };
};

export default update;
