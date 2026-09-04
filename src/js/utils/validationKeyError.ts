import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";

const getValidationKey = (routeObj: Route, validations: ValidationsObj) => {
  const key = routeObj.validation;

  // if false
  if (typeof key === "boolean")
    if (key) {
      throw new AppError({
        message: "validation as boolean can only be 'false'",
        statusCode: 400,
        hint: "Make it false without ('', \"\" or ``)",
        details: getErrorDetail(routeObj),
      });
    } else {
      if (routeObj.method !== "get")
        throw new AppError({
          message: "validation is missing",
          statusCode: 400,
          hint: `body is required for method: '${routeObj.method}'`,
          details: getErrorDetail(routeObj),
        });

      return;
    }

  // if validation not provided
  if (key == null)
    throw new AppError({
      message: "validation is required",
      statusCode: 400,
      hint: "Provide it or make it 'false' as boolean if this routeObj doesn't need validation",
      details: getErrorDetail(routeObj),
    });

  // validationObject
  const validateObject = validations[key as string];

  // if validation not provided
  if (!validateObject)
    throw new AppError({
      message: `validation: '${key}' is missing in validations`,
      statusCode: 400,
      hint: `In validations, use the '${key}' as key for validation`,
      details: getErrorDetail(routeObj),
    });

  // validate object
  return validateObject;
};

export default getValidationKey;
