import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import AppLog from "../../utils/AppLog.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const authorizeAccess = ({
  routeObj,
  route,
  item,
  req,
}: {
  routeObj: Route;
  route: string;
  item?: any;
  req: Request;
}) => {
  // if auth !== admin or adminOrOwner
  if (routeObj.auth !== "admin" && routeObj.auth !== "adminOrOwner")
    throw new AppError({
      message: "auth should only be 'admin' or 'adminOrOwner'",
      statusCode: 409,
      hint: "Make the auth admin or adminOrOwner based on your routeObj requirement. Checkout collection -> routes -> auth",
      details: getErrorDetail(routeObj),
    });

  // if removeAll to not admin
  if (routeObj.auth !== "admin" && routeObj.handler === "removeAll")
    throw new AppError({
      message: "auth should only be 'admin'",
      statusCode: 409,
      hint: "Make the auth admin. Checkout collection -> routes -> auth",
      details: getErrorDetail(routeObj),
    });

  // vars
  const ownerId = routeObj.ownership === "self" ? item._id : item?.owner?._id;
  const isOwner = !!ownerId && !!req.user && ownerId.equals(req.user._id);
  const isAdmin = req.user.role === "admin";

  // if owner id in item not found
  if (!ownerId) {
    AppLog("x", "authorization", `owner not found in item.`);
    AppLog(
      "warn",
      "authorization",
      `If this route doesn't have owner, use ownership: "self" in routes -> route. routeObj: '/${route}', method: '${routeObj.method}' and path: '${routeObj.path}'`,
    );
  }

  // allow only admin
  if (routeObj.auth === "admin") {
    if (!isAdmin)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
        hint: "You are not the admin. If this route doesn\'t have owner, use ownership: 'self' in routes -> route.",
        details: getErrorDetail(routeObj),
      });
  }

  // if allow both admin or owner
  if (routeObj.auth === "adminOrOwner") {
    if (!isAdmin && !isOwner)
      throw new AppError({
        message: "Unauthorized",
        statusCode: 403,
        hint: "You are not the owner. If this route doesn\'t have owner, use ownership: 'self' in routes -> route.",
        details: getErrorDetail(routeObj),
      });
  }
};

export default authorizeAccess;
