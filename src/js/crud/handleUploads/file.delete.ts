import type { Route, ValidationsObj } from "../../types/Collection.ts";
import type { Request, Response } from "express";
import getItem from "../utils/getItem.js";
import handleDeleteFile from "../../upload/delete.js";
import getParam from "../utils/getParam.js";
import appResponse from "../../utils/response.js";
import getValidationKey from "../../utils/validationKeyError.js";
import validate from "../../utils/validate.js";
import authorizeAccess from "../utils/authroizeAccess.js";

const deleteFile = ({
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

    // validation
    const body = validate(validationObj, req.body, routeObj);

    // get param
    const param = getParam({
      req,
      routeObj
    });

    // get item
    const item = await getItem({
      modelName,
      routeName,
      _id: param as string,
      path: routeObj.path,
      clean: false,
      routeObj
    });

     // authorizeAccess
    authorizeAccess({ routeObj, routeName, item, req });

    // delete file from cloudinary
    const { _id, mongooseField } =
      (await handleDeleteFile(routeObj, body, item)) || {};

    // remove from mongoose array
    item[mongooseField as string].id(_id)?.deleteOne();

    // save
    await item.save();

    // response
    appResponse({
      res,
      message: "File deleted successfully!",
    });
  };
};

export default deleteFile;
