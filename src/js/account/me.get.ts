import { getEnvs } from "../config/envs.js";
import { findUser } from "../middleware/auth.middleware.js";
import type { Route } from "../types/Collection.js";
import type { Request, Response } from "express";
import appResponse from "../utils/response.js";
import { sanitizeOne } from "../utils/sanitize.js";

const getMe = ({ routeObj }: { routeObj: Route }) => {
  return async (req: Request, res: Response) => {
    const { userModelName } = getEnvs();
    const user = await findUser(req.user._id, routeObj, userModelName!);

    appResponse({
      res,
      data: sanitizeOne(user.toObject(), routeObj),
      message: "Welcome back!",
    });
  };
};
export default getMe;
