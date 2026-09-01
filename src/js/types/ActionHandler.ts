import type { Request } from "express";
import type { Document } from "mongoose";

export interface CreateContext {
  req: Request;
  user: Request["user"];

  routeName: string;
  operation: "create" | "update" | "remove";
  modelName: string;
  Model: any;

  data: {
    owner: string;
    body: any;
    fileMetaData?: any;
    encryptedFields?: any;
    hashedFields?: any;
  };
  item?: Document;
}

export interface Action {
  type: "custom" | "email";
  handler: (context: CreateContext) => Promise<void> | void;
}
