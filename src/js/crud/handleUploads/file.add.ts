import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../../types/Collection.js";
import getItem from "../utils/getItem.js";
import getParam from "../utils/getParam.js";
import appResponse from "../../utils/response.js";
import { handleUploadFiles } from "../../upload/index.js";
import AppError from "../../utils/AppError.js";
import authorizeAccess from "../utils/authroizeAccess.js";
import getErrorDetail from "../../utils/getErrorDetail.js";


const addFile = ({
  modelName,
  routeName,
  route,
}: {
  modelName: string;
  routeName: string;
  route: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // if fileArray is missing
    if (!route?.fileArray?.length)
      throw new AppError({
        message: "fileArray is missing or empty",
        statusCode: 400,
        code: "INVALID_CONFIGURATION",
        hint: "Checkout the collection configuration if fileArray is missing or empty",
        details: getErrorDetail(route),
      });

    // get param
    const param = getParam({
      req,
      route
    });

    // get item
    const item = await getItem({
      modelName,
      routeName,
      _id: param as string,
      path: route.path,
      clean: false,
      route,
    });

    // authorizeAccess
    authorizeAccess({ route, routeName, item, req });

    // upload files
    const fileMetaData = await handleUploadFiles(req, route);

    if (fileMetaData) {
      for (const [field, files] of Object.entries(fileMetaData)) {
        const mongooseSchemaField = item[field];

        if (!mongooseSchemaField)
          throw new AppError({
            message: `mongooseSchemaFieldName: '${field}' not found in mongodb document.`,
            statusCode: 400,
            code: "INVALID_CONFIGURATION",
            hint: "Check if 'mongooseSchemaFieldName' is wrong. It should match the array [] name of your mongodb document.",
            details: {
              handler: route.handler,
              method: route.method,
              path: route.path,
            },
          });
        item[field].push(...files);
      }
    }

    // save
    await item.save();

    // response
    appResponse({
      res,
      message: "File added successfully!",
    });
  };
};

export default addFile;
