import multer from "multer";
import AppError from "../utils/AppError.js";
import type { Upload } from "../types/upload.js";
import type { Route } from "../types/Collection.js";
import type { NextFunction, Request, Response } from "express";

const storage = multer.memoryStorage();

const multerMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter(req, file, cb) {
    // if (!file.mimetype.startsWith("image/")) {
    //   return cb(
    //     new AppError({
    //       message: "Only image files are allowed.",
    //       statusCode: 400,
    //       code: "UPLOAD_INVALID_IMAGE",
    //       hint: "Upload only image files.",
    //       details: {
    //         handler: routeObj.handler,
    //         method: routeObj.method,
    //         path: routeObj.path,
    //       },
    //     }),
    //   );
    // }

    cb(null, true);
  },
});

export const handleMulterMiddleware = (
  files: Upload[],
  routeObj: Route,
) => {
  if (!Array.isArray(files))
    throw new AppError({
      message: "files must be an array.",
      statusCode: 400,
      hint: "Provide files as an array in the collection configuration.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const fields = files.map((upload) => ({
    name: upload.paramField,
    maxCount: upload.multiple ? 10 : 1,
  }));

  const upload = multerMiddleware.fields(fields);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (!err) return next();

      if (err instanceof AppError) {
        return next(err);
      }

      if (err instanceof multer.MulterError) {
        let message = err.message;
        let code:
          | "UPLOAD_TOO_LARGE"
          | "UPLOAD_TOO_MANY_FILES"
          | "UPLOAD_FIELD_NOT_FOUND"
          | "UPLOAD_FAILED" = "UPLOAD_FAILED";

        switch (err.code) {
          case "LIMIT_FILE_SIZE":
            message = "File size must not exceed 5 MB.";
            code = "UPLOAD_TOO_LARGE";
            break;

          case "LIMIT_FILE_COUNT":
            message = "Too many files uploaded.";
            code = "UPLOAD_TOO_MANY_FILES";
            break;

          case "LIMIT_UNEXPECTED_FILE":
            message = `Unexpected file field: '${err.field}'.`;
            code = "UPLOAD_FIELD_NOT_FOUND";
            break;

          case "LIMIT_PART_COUNT":
            message = "Too many form parts.";
            break;

          case "LIMIT_FIELD_COUNT":
            message = "Too many fields.";
            break;

          case "LIMIT_FIELD_VALUE":
            message = "Field value is too large.";
            break;
        }

        return next(
          new AppError({
            message,
            statusCode: 400,
            code,
            hint:
              code === "UPLOAD_TOO_LARGE"
                ? "Reduce the file size and try again."
                : code === "UPLOAD_TOO_MANY_FILES"
                  ? "Reduce the number of uploaded files."
                  : code === "UPLOAD_FIELD_NOT_FOUND"
                    ? "Ensure the uploaded field name matches collection -> routeObj -> files -> paramField. If these are multiple files, make 'multiple: true;'"
                    : "Check the upload request and try again.",
            details: {
              handler: routeObj.handler,
              method: routeObj.method,
              path: routeObj.path,
            },
          }),
        );
      }

      return next(
        new AppError({
          message: "File upload failed.",
          statusCode: 500,
          hint: "An unexpected error occurred while processing the upload.",
          details: {
            handler: routeObj.handler,
            method: routeObj.method,
            path: routeObj.path,
          },
        }),
      );
    });
  };
};