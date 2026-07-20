import type { Route } from "../../types/Collection.js";
import AppError from "../../utils/AppError.js";
import getModel from "../../utils/getModel.js";
import { sanitizeMany, sanitizeOne } from "../../utils/sanitize.js";

const getItem = async ({
  modelName,
  routeName,
  path,
  _id,
  clean = true,
  route
}: {
  modelName: string;
  routeName: string;
  path?: string;
  _id?: string;
  clean?: boolean;
  route: Route
}) => {
  // get model
  const Model = getModel({ modelName, routeName, route });

  // initialize data
  let data: any = null;

  try {
    if (_id) {
      // if only 1 item to find
      data = await Model?.findById(_id).populate("owner", "_id email");
    } else {
      // if all items to find
      data = await Model?.find().populate("owner", "_id email");
    }
    // catch error
  } catch (error) {
    // get err message
    const msg = (error as Error).message;
    // if _id is wrong
    if (msg.includes("Cast to ObjectId failed")) {
      throw new AppError({
        message: `Invalid mongoose _id | route: /${routeName}`,
        statusCode: 409,
      });
    } else {
      // general purpose error
      throw new AppError({
        message: `Error while finding item for the id: ${_id} | route: /${routeName}`,
        statusCode: 409,
      });
    }
  }

  // if item(s) not found
  const notFound = Array.isArray(data) ? data.length === 0 : data == null;

  if (notFound) {
    throw new AppError({
      message: `${_id ? "Item" : "Data"} not found for route: /${routeName}`,
      statusCode: 404,
      data: {
        nextStep: _id
          ? `Check the '${path ?? "path"}' you provided in url: /${_id}`
          : "Hit a POST request and insert an item",
      },
    });
  }

  if (clean) {
    data = Array.isArray(data)
      ? sanitizeMany(data)
      : sanitizeOne(data.toObject());
  }

  // return item or items
  return data;
};

export default getItem;
