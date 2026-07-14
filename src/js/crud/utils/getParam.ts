import type { Request } from "express";
import AppError from "../../utils/AppError.js";

const getParam = ({
  req,
  routeName,
  handler,
}: {
  req: Request;
  routeName: string;
  handler: string;
}) => {
  const key: string = Object.keys(req.params)[0]!;

  if (!key)
    throw new AppError({
      message: `path: '/:[param]' is required for handler: '${handler}' to get an item for route: '${routeName}'`,
      statusCode: 409,
    });

  return req.params[key];
};

export default getParam;
