import type { Route, ValidationsObj } from "../../types/Collection.ts";
import type { Request, Response } from "express";
import getItem from "../utils/getItem.js";
import handleUpdateFile from "../../upload/update.js";
import getParam from "../utils/getParam.js";
import appResponse from "../../utils/response.js";
import getValidationKey from "../../utils/validationKeyError.js";
import validate from "../../utils/validate.js";
import authorizeAccess from "../utils/authorizeAccess.js";

const updateFile = ({
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
    const param = getParam({ req, routeObj });

    // get item
    let item = await getItem({
      modelName,
      routeName,
      _id: param as string,
      path: routeObj.path,
      clean: false,
      routeObj
    });

    // authorizeAccess
    authorizeAccess({ routeObj, routeName, item, req });

    // update file
    const { updated, _id, mongooseField } =
      (await handleUpdateFile(req, routeObj, body, item)) || {};

    // get old
    const old = item[mongooseField as string].id(_id);

    // copy - paste updated init
    Object.assign(old, updated);

    // save
    await item.save();

    // app response
    appResponse({ res, message: "File updated successfully!" });
  };
};

export default updateFile;
