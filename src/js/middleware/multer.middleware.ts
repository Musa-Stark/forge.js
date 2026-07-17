import multer from "multer";
import AppError from "../utils/AppError.js";
import type { Upload } from "../types/upload.js";
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
    //     }),
    //   );
    // }

    cb(null, true);
  },
});

export const handleMulterMiddleware = (uploadArray: Upload[]) => {
  const fields = uploadArray.map((upload) => ({
    name: upload.fieldName,
    maxCount: upload.multiple ? 10 : 1,
  }));

  const upload = multerMiddleware.fields(fields);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (!err) return next();

      // Your AppError from fileFilter
      if (err instanceof AppError) {
        return next(err);
      }

      // Multer errors
      if (err instanceof multer.MulterError) {
        let message = err.message;

        switch (err.code) {
          case "LIMIT_FILE_SIZE":
            message = "File size must not exceed 5 MB.";
            break;

          case "LIMIT_FILE_COUNT":
            message = "Too many files uploaded.";
            break;

          case "LIMIT_UNEXPECTED_FILE":
            message = `Unexpected file field: ${err.field}`;
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
          }),
        );
      }

      // Unknown errors
      return next(
        new AppError({
          message: "File upload failed.",
          statusCode: 500,
        }),
      );
    });
  };
};
