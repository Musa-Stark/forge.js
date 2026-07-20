import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.ts";
import AppLog from "../../utils/AppLog.js";

const authorizeAccess = ({
  route,
  routeName,
  item,
  req,
}: {
  route: Route;
  routeName: string;
  item?: any;
  req: Request;
}) => {
  console.log("working");
  // if authRole !== admin or adminOrOwner
  if (route.authRole !== "admin" && route.authRole !== "adminOrOwner")
    throw new AppError({
      message: `authRole should only be 'admin' or 'adminOrOwner' for route: '/${routeName}', method: '${route.method}' and path: '${route.path}'`,
      statusCode: 409,
    });

  // if removeAll to not admin
  if (route.authRole !== "admin" && route.handler === "removeAll")
    throw new AppError({
      message: `authRole should only be 'admin' for route: '/${routeName}', method: '${route.method}' and path: '${route.path}'`,
      statusCode: 409,
    });

  // vars
  const ownerId = item?.owner?._id;
  const isOwner = ownerId && req.user && ownerId.equals(req.user._id);
  const isAdmin = req.user.role === "admin";

  // if owner id in item not found
  if (!ownerId)
    AppLog(
      "x",
      "authorization",
      `owner not found in item for route: '/${routeName}', method: '${route.method}' and path: '${route.path}'`,
    );

  // allow only admin
  if (route.authRole === "admin") {
    if (!isAdmin)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
      });
  }

  // if allow both admin or owner
  if (route.authRole === "adminOrOwner") {
    if (!isAdmin && !isOwner)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
      });
  }
};

export default authorizeAccess;
