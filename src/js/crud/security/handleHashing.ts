import type { Route } from "../../types/Collection.js";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import { hash } from "../../utils/libsodium.js";

const handleHashing = async (body: any, routeObj: Route) => {
  const hashArr = routeObj.hashedFieldsArray;

  // If hashedFieldsArray is not configured, skip hashing.
  if (!hashArr) return;

  // Validate configuration type.
  if (!Array.isArray(hashArr)) {
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "hashedFieldsArray must be an array of field names.",
      message: "Hashing configuration is invalid.",
      statusCode: 409,
    });
  }

  // Validate configuration is not empty.
  if (!hashArr.length) {
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "Add at least one field name to hashedFieldsArray.",
      message: "Hashing configuration is empty.",
      statusCode: 409,
    });
  }

  const hashed: Record<string, string> = {};

  for (let field of hashArr) {
    const optional = field.endsWith("?");
    field = optional ? field.slice(0, -1) : field;

    // Validate that the field exists in the request body.
    if (!Object.hasOwn(body, field)) {
      if (optional) {
        continue;
      }

      throw new AppError({
        details: getErrorDetail(routeObj),
        hint: `Make sure '${field}' is included in the request body.`,
        message: `The required field '${field}' is missing to hash.`,
        statusCode: 400,
      });
    }

    // Only strings can be hashed.
    if (typeof body[field] !== "string") {
      throw new AppError({
        details: getErrorDetail(routeObj),
        hint: `The field '${field}' must contain a string value.`,
        message: `The field '${field}' is not allowed for hashing. Only strings can be hashed.`,
        statusCode: 400,
      });
    }

    hashed[field] = await hash(body[field], routeObj);
  }

  return hashed;
};

export default handleHashing;
