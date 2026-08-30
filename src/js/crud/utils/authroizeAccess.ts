import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.ts";
import AppLog from "../../utils/AppLog.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const authorizeAccess = ({
  routeObj,
  routeName,
  item,
  req,
}: {
  routeObj: Route;
  routeName: string;
  item?: any;
  req: Request;
}) => {
  // if authRole !== admin or adminOrOwner
  if (routeObj.authRole !== "admin" && routeObj.authRole !== "adminOrOwner")
    throw new AppError({
      message: "authRole should only be 'admin' or 'adminOrOwner'",
      statusCode: 409,
      hint: "Make the authRole admin or adminOrOwner based on your routeObj requirement. Checkout collection -> routes -> authRole",
      details: getErrorDetail(routeObj),
    });

  // if removeAll to not admin
  if (routeObj.authRole !== "admin" && routeObj.handler === "removeAll")
    throw new AppError({
      message: "authRole should only be 'admin'",
      statusCode: 409,
      hint: "Make the authRole admin. Checkout collection -> routes -> authRole",
      details: getErrorDetail(routeObj),
    });

  // vars
  const ownerId = routeObj.ownerShip === "self" ? item._id : item?.owner?._id;
  const isOwner = !!ownerId && !!req.user && ownerId.equals(req.user._id);
  const isAdmin = req.user.role === "admin";

  // if owner id in item not found
  if (!ownerId)
    AppLog(
      "warn",
      "authorization",
      `owner not found in item for routeObj: '/${routeName}', method: '${routeObj.method}' and path: '${routeObj.path}'`,
    );

  // allow only admin
  if (routeObj.authRole === "admin") {
    if (!isAdmin)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
        hint: "You are not the admin.",
        details: getErrorDetail(routeObj),
      });
  }

  // if allow both admin or owner
  if (routeObj.authRole === "adminOrOwner") {
    if (!isAdmin && !isOwner)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
        hint: "You are not the owner.",
        details: getErrorDetail(routeObj),
      });
  }
};

export default authorizeAccess;
