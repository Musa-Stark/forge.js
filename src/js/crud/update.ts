import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import getParam from "./utils/getParam.js";
import getItem from "./utils/getItem.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "./utils/authorizeAccess.js";
import getValidationKey from "../utils/validationKeyError.js";
import handleEncryption from "./encryption/handleEncryption.js";
import handleHashing from "./security/handleHashing.js";
import runActions from "./utils/runActions.js";

const update = ({
  model,
  route,
  routeObj,
  validations,
}: {
  model: string;
  route: string;
  routeObj: Route;
  validations: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validations);

    // get /:parameter
    const id = getParam({ req, routeObj });

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // ensure item exists
    const item = await getItem({
      model,
      route,
      _id: id as string,
      routeObj,
    });

    // authorize access
    authorizeAccess({ item, req, routeObj, route });

    // if encryptedFields
    const encryptedFields = await handleEncryption(req.body, routeObj);

    // if hashedFields
    const hashedFields = await handleHashing(req.body, routeObj);

    // model
    const Model = getModel({ model, route, routeObj });

    // runActions object
    const ActionObj = {
      req,
      user: req.user,
      route,
      model,
      Model,
      data: {
        body,
        encryptedFields,
        hashedFields,
      },
    };

    // before action
    let modifiedResponse = await runActions(routeObj.actions?.before, {
      operation: "update",
      ...ActionObj,
    });

    // update
    const updatedItem = await Model.findByIdAndUpdate(
      id,
      { ...body, ...encryptedFields, ...hashedFields },
      {
        returnDocument: "after",
      },
    );

    // cleaned
    const cleaned = sanitizeOne(updatedItem!.toObject(), routeObj);

    // if '_id' excluded
    const idExcluded =
      routeObj.config?.hiddenFields?.includes("_id");
    if (idExcluded) delete cleaned["_id"];

    // after action
    modifiedResponse = await runActions(routeObj.actions?.after, {
      ...ActionObj,
      operation: "update",
      item: cleaned,
    });

    // return response
    appResponse({
      res,
      data: modifiedResponse ?? cleaned,
      message: "Item updated successfully!",
    });
  };
};

export default update;
