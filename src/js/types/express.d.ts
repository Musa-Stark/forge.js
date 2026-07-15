import type { HydratedDocument } from "mongoose";
import type { IUser } from "../models/User.js"; // Adjust the path

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<IUser>;
    }
  }
}

export {};
