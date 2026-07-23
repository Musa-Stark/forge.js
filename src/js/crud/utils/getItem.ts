import type { Route } from "../../types/Collection.js";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import getModel from "../../utils/getModel.js";
import { sanitizeMany, sanitizeOne } from "../../utils/sanitize.js";

const getItem = async ({
  modelName,
  routeName,
  path,
  _id,
  clean = true,
  route,
}: {
  modelName: string;
  routeName: string;
  path?: string;
  _id?: string;
  clean?: boolean;
  route: Route;
}) => {
  // get model
  const Model = getModel({ modelName, routeName, route });

  // initialize data
  let data: any = null;

  try {
    let query;

    // if _id provided?? find 1 item else find all
    if (_id) {
      query = Model.findById(_id);
    } else {
      query = Model.find();
    }

    // populateKey - populate
    const populateKey = route?.mongooseConfigObj?.populateKey;
    if (populateKey) {
      if (typeof populateKey === "boolean")
        throw new AppError({
          code: "CRUD_CONFIGURATION_INVALID",
          hint: "populateKey as boolean must be 'false' only. Else it should be string, representing the ref in your mongooseSchemaObj.",
          message: "Invalid populateKey",
          statusCode: 409,
          details: getErrorDetail(route),
        });
      query = query.populate(populateKey as string, "_id email");
    }

    data = await query;
  } catch (error) {
    // get err message
    const msg = (error as Error).message;
    // if _id is wrong
    if (msg.includes("Cast to ObjectId failed")) {
      throw new AppError({
        message: `Invalid mongoose _id`,
        statusCode: 409,
        code: "CRUD_ITEM_NOT_FOUND",
        hint: "Check the /:id you provided in URL. It doesn't match any document's _id in database.",
        details: getErrorDetail(route),
      });
    } else {
      // general purpose error
      const err = error as AppError;
      console.log(err);
      throw new AppError({
        message: err.message || "Error while finding item(s)",
        statusCode: err.statusCode || 409,
        code: err.code || "CRUD_ITEM_ERROR",
        hint: err.hint || "Check the logs for detail info.",
        details: err.details || getErrorDetail(route),
      });
    }
  }

  // if item(s) not found
  const notFound = Array.isArray(data) ? data.length === 0 : data == null;

  if (notFound) {
    throw new AppError({
      message: `${_id ? "Item" : "Data"} not found`,
      statusCode: 404,
      code: "CRUD_ITEM_NOT_FOUND",
      hint: _id
        ? `Check the '${path ?? "path"}' you provided in url: /${_id}`
        : "Hit a POST request and create an item",
      details: getErrorDetail(route),
    });
  }

  if (clean) {
    data = Array.isArray(data)
      ? sanitizeMany(data, route)
      : sanitizeOne(data.toObject(), route);
  }

  // return item or items
  return data;
};

export default getItem;
