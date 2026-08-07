import type { Route } from "../../types/Collection.ts";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import { seal } from "../../utils/libsodium.js";
import type { SealResult } from "../../utils/libsodium.ts";

const handleEncryption = async (body: any, routeObj: Route) => {
  const encArr = routeObj.encryptedFieldsArray;

  // if encryptedFieldsArray not found
  if (!encArr) return;

  // if not array
  if (!Array.isArray(encArr))
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "encryptedFieldsArray must be an array.",
      message: "Invalid configuration for encryptedFieldsArray.",
      statusCode: 409,
    });

  // if length is 0
  if (!encArr.length)
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "Write at least 1 element in encryptedFieldsArray",
      message:
        "Invalid configuration for encryptedFieldsArray, expected at least 1 element",
      statusCode: 409,
    });

  // loop through the array
  const encrypted: Record<string, SealResult> = {};

  for (let el of encArr) {
    // if el to be encrypted not found in req.body
    if (!Object.hasOwn(body, el))
      throw new AppError({
        details: getErrorDetail(routeObj),
        hint: `'Make sure '${el}' is present in the request body.`,
        message: `'${el}' not found in body`,
        statusCode: 409,
      });

    encrypted[el] = await seal(body[el], routeObj);
  }

  return encrypted;
};

export default handleEncryption;
