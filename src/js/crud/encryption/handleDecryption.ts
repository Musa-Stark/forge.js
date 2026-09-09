import type { Route } from "../../types/Collection.js";
import { unSeal } from "../../utils/libsodium.js";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const handleDecryption = async (item: any, routeObj: Route) => {
  const decArr = routeObj.decryptedFields;

  // If decryptedFields is not configured, skip decryption.
  if (!decArr) return;

  // Validate configuration type.
  if (!Array.isArray(decArr)) {
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "decryptedFields must be an array of field names.",
      message: "Decryption configuration is invalid.",
      statusCode: 409,
    });
  }

  // Validate configuration is not empty.
  if (!decArr.length) {
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "Add at least one field name to decryptedFields.",
      message: "Decryption configuration is empty.",
      statusCode: 409,
    });
  }

  const decrypted: Record<string, string> = {};

  for (let field of decArr) {
    // clean the optional
    const optional = field.endsWith("?");
    field = optional ? field.slice(0, -1) : field;

    // Validate that the field exists in the request body.
    if (!Object.hasOwn(item, field))
      if (optional) {
        continue;
      } else {
        throw new AppError({
          details: getErrorDetail(routeObj),
          hint: `Make sure '${field}' is found in the item: ${item._id}. If '${field}' is not found in some items, make it ${field}?`,
          message: `The required field '${field}' is missing is to decrypt.`,
          statusCode: 400,
        });
      }

    const { str, nonce, publicKey, securedPrivateKey } = item[field];
    if (!str || !nonce || !publicKey || !securedPrivateKey)
      throw new AppError({
        details: getErrorDetail(routeObj),
        hint: "str, nonce, publicKey and securedPrivateKey all are required to decrypt the string",
        message: "Essentials missing for decryption",
        statusCode: 404,
      });

    decrypted[field] = await unSeal({
      str,
      nonce,
      publicKey,
      securedPrivateKey,
      routeObj,
    });
  }

  return decrypted;
};

export default handleDecryption;
