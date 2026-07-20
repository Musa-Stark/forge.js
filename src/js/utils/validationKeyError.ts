import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";

const getValidationKey = (route: Route, validationsObj: ValidationsObj) => {
  const key = route.validationKey;

  // if false
  if (typeof key === "boolean")
    if (key) {
      throw new AppError({
        message: "validationKey as boolean can only be 'false'",
        statusCode: 400,
        hint: "Make it false without ('', \"\" or ``)",
        code: "ROUTE_VALIDATION_KEY_INVALID",
        details: getErrorDetail(route),
      });
    } else {
      return;
    }

  // if validationKey not provided
  if (key == null)
    throw new AppError({
      message: "validationKey is required",
      statusCode: 400,
      code: "ROUTE_VALIDATION_KEY_REQUIRED",
      hint: "Provide it or make it false if this route doesn't need validation",
      details: getErrorDetail(route),
    });

  // validationObject
  const validateObject = validationsObj[key as string];

  // if validation not provided
  if (!validateObject)
    throw new AppError({
      message: `validationKey: '${key}' is missing in validationsObj`,
      statusCode: 400,
      code: "VALIDATION_REQUIRED_FIELD_MISSING",
      hint: `In validationsObj, use the '${key}' as key for validation`,
      details: getErrorDetail(route),
    });

  // validate object
  return validateObject;
};

export default getValidationKey;
