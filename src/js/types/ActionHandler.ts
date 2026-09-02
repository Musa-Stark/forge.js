import type { Request } from "express";
import type { Document } from "mongoose";

export interface CreateContext {
  req: Request;
  user: Request["user"];

  routeName: string;
  operation: "read" | "readAll" | "create" | "update" | "remove" | "removeMultiple" | "removeAll";
  modelName: string;
  Model?: any;

  data?: {
    owner?: string;
    body?: any;
    fileMetaData?: any;
    encryptedFields?: any;
    decryptedFields?: any;
    hashedFields?: any;
  };
  item?: Document | Document[];
  result?: any;
}

export interface Action {
  type: "custom" | "email";
  handler: (context: CreateContext) => Promise<void> | void;
}
