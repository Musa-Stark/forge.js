import type { Request } from "express";
import type { Document } from "mongoose";

export interface CreateContext {
  req: Request;
  user: Request["user"];

  resource: string;
  operation: "create" | "update" | "remove";

  data: {
    owner: string;
    body: any;
    fileMetaData?: any;
    encryptedFields?: any;
    hashedFields?: any;
    Model: any;
  };
  item?: Document;
}

export interface Action {
  handler: (context: CreateContext) => Promise<void> | void;
}
