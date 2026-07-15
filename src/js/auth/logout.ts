import type { Request, Response } from "express";
import { clearCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";

const logout = () => {
  return async (req: Request, res: Response) => {
    clearCookie({ res, cookieName: "authToken" });

    appResponse({ res, message: "Logged out successfully!" });
  };
};
export default logout;
