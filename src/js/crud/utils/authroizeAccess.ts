import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.ts";
import AppLog from "../../utils/AppLog.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

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
      message: "authRole should only be 'admin' or 'adminOrOwner'",
      statusCode: 409,
      code: "FRAMEWORK_CONFIGURATION_INVALID",
      hint: "Make the authRole admin or adminOrOwner based on your route requirement. Checkout collection -> routes -> authRole",
      details: getErrorDetail(route),
    });

  // if removeAll to not admin
  if (route.authRole !== "admin" && route.handler === "removeAll")
    throw new AppError({
      message: "authRole should only be 'admin'",
      statusCode: 409,
      code: "FRAMEWORK_CONFIGURATION_INVALID",
      hint: "Make the authRole admin. Checkout collection -> routes -> authRole",
      details: getErrorDetail(route),
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
        code: "PERMISSION_DENIED",
        hint: "You are not the admin.",
        details: getErrorDetail(route),
      });
  }

  // if allow both admin or owner
  if (route.authRole === "adminOrOwner") {
    if (!isAdmin && !isOwner)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
        code: "PERMISSION_DENIED",
        hint: "You are not the owner.",
        details: getErrorDetail(route),
      });
  }
};

export default authorizeAccess;
