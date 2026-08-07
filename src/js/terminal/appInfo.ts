import type { Collection } from "../types/Collection.js";

export interface AppInfo {
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
  dbConnectionStatus: string | null;
}

let appInfo: AppInfo = {
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
  dbConnectionStatus: null,
};

const resources: string[] = ["OTP Model"];

const setAppInfo = (req: Collection) => {
  if (req.modelName && !resources.includes(req.modelName)) {
    if (req.mongooseSchemaObj) appInfo.modelsCount!++;

    resources.push(req.modelName);
  }

  if (req.validationsObj) appInfo.validationsCount!++;

  if (req.reqType === "auth") appInfo.authentication = true;

  if (req.routesArray) {
    appInfo.routesCount! += req.routesArray.length;
    for (const el of req.routesArray) {
      if (el.fileArray) appInfo.fileUpload = true;
      if (el.authRole === "admin" || el.authRole === "adminOrOwner")
        appInfo.authorization = true;
    }
  }
};

export { appInfo, setAppInfo, resources };
