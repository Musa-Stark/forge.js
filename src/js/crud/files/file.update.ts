import type { Route, ValidationsObj } from "../../types/Collection.ts";
import type { Request, Response } from "express";
import getItem from "../utils/getItem.js";
import handleUpdateFile from "../../upload/update.js";
import getParam from "../utils/getParam.js";
import appResponse from "../../utils/response.js";
import getValidationKey from "../../utils/validationKeyError.js";
import validate from "../../utils/validate.js";

const updateFile = ({
  modelName,
  routeName,
  route,
  validationsObj,
}: {
  modelName: string;
  routeName: string;
  route: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // validationObj
    const validationObj = getValidationKey(route, validationsObj);

    // console.log("Route: ", route)

    // validation
    const body = validate(validationObj, req.body);
    // console.log(body);

    // get param
    const param = getParam({ req, routeName, handler: route.handler });
    // console.log("Param: ", param);

    // get item
    const item = await getItem({
      modelName,
      routeName,
      _id: param as string,
      path: route.path,
    });

    // console.log("item: ", item);

    // update file
    const updated = await handleUpdateFile(req, route, body, item);
    // console.log("updated: ", updated);

    // item.save()

    // findbyidandupdate

    // app response
    appResponse({ res, message: "File updated successfully!" });
  };
};

export default updateFile;
