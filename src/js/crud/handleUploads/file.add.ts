import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../../types/Collection.js";
import getItem from "../utils/getItem.js";
import getParam from "../utils/getParam.js";
import appResponse from "../../utils/response.js";
import { handleUploadFiles } from "../../upload/index.js";
import AppError from "../../utils/AppError.js";
import authorizeAccess from "../utils/authorizeAccess.js";
import getErrorDetail from "../../utils/getErrorDetail.js";


const addFile = ({
  modelName,
  routeName,
  routeObj,
}: {
  modelName: string;
  routeName: string;
  routeObj: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // if fileArray is missing
    if (!routeObj?.fileArray?.length)
      throw new AppError({
        message: "fileArray is missing or empty",
        statusCode: 400,
        hint: "Checkout the collection configuration if fileArray is missing or empty",
        details: getErrorDetail(routeObj),
      });

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
      routeObj,
    });

    // authorizeAccess
    authorizeAccess({ routeObj, routeName, item, req });

    // upload files
    const fileMetaData = await handleUploadFiles(req, routeObj);

    if (fileMetaData) {
      for (const [field, files] of Object.entries(fileMetaData)) {
        const mongooseSchemaField = item[field];

        if (!mongooseSchemaField)
          throw new AppError({
            message: `mongooseSchemaFieldName: '${field}' not found in mongodb document.`,
            statusCode: 400,
            hint: "Check if 'mongooseSchemaFieldName' is wrong. It should match the array [] name of your mongodb document -> fileMetaData.",
            details: {
              handler: routeObj.handler,
              method: routeObj.method,
              path: routeObj.path,
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
      data: item,
      message: "File added successfully!",
    });
  };
};

export default addFile;
