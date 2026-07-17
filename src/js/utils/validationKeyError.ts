import type { Route, ValidationsObj } from "../types/Collection.ts";
import AppError from "./AppError.js";

const getValidationKey = (route: Route, validationsObj: ValidationsObj) => {
  const key = route.validationKey;

  // if false
  if (typeof key === "boolean") if (!key) return;
  if (key)
    throw new AppError({
      message: `validationKey as boolean can only be 'false' for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}'`,
      statusCode: 400,
      data: {
        nextStep:
          "Provide it or make it false if this route doesn't need validation",
      },
    });

  // if validationKey not provided
  if (key == null)
    throw new AppError({
      message: `validationKey is required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to validate`,
      statusCode: 400,
      data: {
        nextStep:
          "Provide it or make it false if this route doesn't need validation",
      },
    });

  // validationObject
  const validateObject = validationsObj[key as string];

  // if validation not provided
  if (!validateObject)
    throw new AppError({
      message: `validationKey: '${key}' is missing in validationsObj for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}'`,
      statusCode: 400,
    });

  // validate object
  return validateObject;
};

export default getValidationKey;
