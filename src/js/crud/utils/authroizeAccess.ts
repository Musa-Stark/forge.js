import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.ts";

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
  const isOwner = item?.owner._id.equals(req.user?._id);
  const isAdmin = req.user.role === "admin";

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
