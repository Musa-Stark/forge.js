import type { Route, ValidationsObj } from "../../types/Collection.ts";
import type { Request, Response } from "express";
import getItem from "../utils/getItem.js";
import handleDeleteFile from "../../upload/delete.js";
import getParam from "../utils/getParam.js";
import appResponse from "../../utils/response.js";
import getValidationKey from "../../utils/validationKeyError.js";
import validate from "../../utils/validate.js";
import authorizeAccess from "../utils/authorizeAccess.js";

const deleteFile = ({
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

    // validation
    const body = validate(validationObj, req.body, routeObj);

    // get param
    const param = getParam({
      req,
      routeObj
    });

    // get item
    const item = await getItem({
      model,
      route,
      _id: param as string,
      path: routeObj.path,
      clean: false,
      routeObj
    });

     // authorizeAccess
    authorizeAccess({ routeObj, route, item, req });

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
      data: item
    });
  };
};

export default deleteFile;
