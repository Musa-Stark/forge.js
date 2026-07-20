import type { Request, Response } from "express";
import { clearCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";
import type { Route } from "../types/Collection.js";

const logout = (route: Route) => {
  return async (req: Request, res: Response) => {
    clearCookie({ res, cookieName: "authToken", route });

    appResponse({ res, message: "Logged out successfully!" });
  };
};
export default logout;
