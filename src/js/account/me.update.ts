import type { Request, Response } from "express";
import type { ValidationsObj, Route } from "../types/Collection.js";
import getItem from "../crud/utils/getItem.js";
import validate from "../utils/validate.js";
import getModel from "../utils/getModel.js";
import { sanitizeOne } from "../utils/sanitize.js";
import appResponse from "../utils/response.js";
import authorizeAccess from "../crud/utils/authroizeAccess.js";
import getValidationKey from "../utils/validationKeyError.js";
import handleEncryption from "../crud/encryption/handleEncryption.js";
import handleHashing from "../crud/security/handleHashing.js";
import { getEnvs } from "../config/envs.js";

const update = ({
  routeName,
  routeObj,
  validationsObj,
}: {
  routeName: string;
  routeObj: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // user id
    const id = req.user._id;

    // user model
    const { userModelName } = getEnvs();
    const modelName = userModelName!;

    // ensure item exists
    const item = await getItem({
      modelName,
      routeName,
      _id: id,
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
      { ...body, ...encryptedFields, ...hashedFields },
      {
        returnDocument: "after",
      },
    );

    // cleaned
    const cleaned = sanitizeOne(updatedItem!.toObject(), routeObj);

    // if '_id' excluded
    const idExcluded =
      routeObj.mongooseConfigObj?.hiddenFieldsArray?.includes("_id");
    if (idExcluded) delete cleaned["_id"];

    // return response
    appResponse({
      res,
      data: cleaned,
      message: "Your data has been updated successfully!",
    });
  };
};

export default update;
