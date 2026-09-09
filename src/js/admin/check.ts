import type { Request, Response } from "express";
import appResponse from "../utils/response.js";
import getItem from "../crud/utils/getItem.js";
import type { Route, ValidationsObj } from "../types/Collection.js";
import { findUser } from "../middleware/auth.middleware.js";
import { getEnvs } from "../config/envs.js";
import AppError from "../utils/AppError.js";
import getErrorDetail from "../utils/getErrorDetail.js";

const checkAdmin = ({
  routeObj,
}: {
  routeObj: Route;
}) => {
  return async (req: Request, res: Response): Promise<void> => {
    // roleKeyFound
    const roleKeyFound = "role" in req.user;
    let role: string | null = null;

    // if role not found in req - get from db.user
    if (!roleKeyFound) {
      const user = await findUser(
        req.user._id,
        routeObj,
        getEnvs().userModelName!,
      );
      role = user.data.role ?? null;
    } else {
        role = req.user.role
    }

    // if role not found
    if (!role)
      throw new AppError({
        message: "role not found",
        code: "ROLE_NOT_FOUND",
        statusCode: 404,
        hint: "Add role in user schema: role: mongooseFields.role",
        details: getErrorDetail(routeObj),
      });

    // return response
    appResponse({
      res,
      data: { role },
      message: "Role found successfully!",
    });
  };
};
export default checkAdmin;
