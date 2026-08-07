import type { Collection } from "../types/Collection.ts";

export interface CollectionInfo {
  modelsCount?: number;
  validationsCount?: number;
  routesCount?: number;
  authentication?: boolean;
  authorization?: boolean; //
  autoCrud?: boolean; //
  rateLimiting?: boolean; //
  fileUpload?: boolean;
  errorHandling?: boolean; //
  cors?: boolean; //
}

let collectionInfo: CollectionInfo = {
  modelsCount: 1,
  validationsCount: 0,
  routesCount: 0,
  authentication: false,
  authorization: false,
  autoCrud: false,
  rateLimiting: true,
  fileUpload: false,
  errorHandling: true,
  cors: false,
};

const resources: string[] = ["OTP Model"];

const setCollectionInfo = (req: Collection) => {
  
  if (req.modelName && !resources.includes(req.modelName)) {
    if (req.mongooseSchemaObj) collectionInfo.modelsCount!++;

    resources.push(req.modelName);
  }

  if (req.validationsObj) collectionInfo.validationsCount!++;

  if (req.reqType === "auth") collectionInfo.authentication = true;

  if (req.routesArray) {
    collectionInfo.routesCount! += req.routesArray.length;
    for (const el of req.routesArray) {
      if (el.fileArray) collectionInfo.fileUpload = true;
      if (el.authRole === "admin" || el.authRole === "adminOrOwner")
        collectionInfo.authorization = true;
    }
  }
};

export { collectionInfo, setCollectionInfo, resources };
