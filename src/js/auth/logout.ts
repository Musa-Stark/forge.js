import type { Request, Response } from "express";
import { clearCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";
import type { Route } from "../types/Collection.js";

const logout = (routeObj: Route) => {
  return async (req: Request, res: Response) => {
    clearCookie({ res, cookieName: "authToken", routeObj });

    appResponse({ res, message: "Logged out successfully!" });
  };
};
export default logout;
