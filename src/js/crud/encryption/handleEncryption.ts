import type { Route } from "../../types/Collection.ts";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import { seal } from "../../utils/libsodium.js";
import type { SealResult } from "../../utils/libsodium.ts";

const handleEncryption = async (body: any, routeObj: Route) => {
  const encArr = routeObj.encryptedFields;

  // If encryptedFields is not configured, skip encryption.
  if (!encArr) return;

  // Validate configuration type.
  if (!Array.isArray(encArr)) {
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "encryptedFields must be an array of field names.",
      message: "Encryption configuration is invalid.",
      statusCode: 409,
    });
  }

  // Validate configuration is not empty.
  if (!encArr.length) {
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "Add at least one field name to encryptedFields.",
      message: "Encryption configuration is empty.",
      statusCode: 409,
    });
  }

  const encrypted: Record<string, SealResult> = {};

  for (let field of encArr) {
    const optional = field.endsWith("?");
    field = optional ? field.slice(0, -1) : field;

    // Validate that the field exists in the request body.
    if (!Object.hasOwn(body, field))
      if (optional) {
        continue;
      } else {
        throw new AppError({
          details: getErrorDetail(routeObj),
          hint: `Make sure '${field}' is included in the request body.`,
          message: `The required field '${field}' is missing to encrypt.`,
          statusCode: 400,
        });
      }

    encrypted[field] = await seal(body[field], routeObj);
  }

  return encrypted;
};

export default handleEncryption;
