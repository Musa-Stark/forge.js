import { getEnvs } from "../config/envs.js";
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
  modelsCount: 2,
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

const resources: string[] = ["OTP", "RefreshToken"];

const setAppInfo = (req: Collection) => {
  const { authConfigObj } = getEnvs();

  if (req.model && !resources.includes(req.model)) {
    if (req.schema) appInfo.modelsCount!++;

    resources.push(req.model);
  }

  if (
    authConfigObj.mode === "builtin" &&
    !resources.includes(authConfigObj.schemaObj?.model || "User")
  )
    appInfo.modelsCount!++;

  if (req.validations) appInfo.validationsCount!++;

  if (req.type === "auth") appInfo.authentication = true;

  if (req.routes) {
    appInfo.routesCount! += req.routes.length;
    for (const el of req.routes) {
      if (el.files) appInfo.fileUpload = true;
      if (el.auth === "admin" || el.auth === "adminOrOwner")
        appInfo.authorization = true;
    }
  }
};

export { appInfo, setAppInfo, resources };
