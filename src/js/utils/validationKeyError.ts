import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";

const getValidationKey = (routeObj: Route, validationsObj: ValidationsObj) => {
  const key = routeObj.validationKey;

  // if false
  if (typeof key === "boolean")
    if (key) {
      throw new AppError({
        message: "validationKey as boolean can only be 'false'",
        statusCode: 400,
        hint: "Make it false without ('', \"\" or ``)",
        details: getErrorDetail(routeObj),
      });
    } else {
      return;
    }

  // if validationKey not provided
  if (key == null)
    throw new AppError({
      message: "validationKey is required",
      statusCode: 400,
      hint: "Provide it or make it false if this routeObj doesn't need validation",
      details: getErrorDetail(routeObj),
    });

  // validationObject
  const validateObject = validationsObj[key as string];

  // if validation not provided
  if (!validateObject)
    throw new AppError({
      message: `validationKey: '${key}' is missing in validationsObj`,
      statusCode: 400,
      hint: `In validationsObj, use the '${key}' as key for validation`,
      details: getErrorDetail(routeObj),
    });

  // validate object
  return validateObject;
};

export default getValidationKey;
