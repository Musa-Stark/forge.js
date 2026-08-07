import Banner from "./logger.js";
import { getEnvs } from "../config/envs.js";
import { appInfo, resources } from "./appInfo.js";
import type { AppInfo } from "./appInfo.js";

const printInfo = () => {
  const { apiVersion, ENV, port, databaseName } = getEnvs();
  const features = [];

  const infokeys = Object.keys(appInfo) as [keyof AppInfo];
  for (const el of infokeys) {
    const item = appInfo[el];
    if (typeof item === "boolean" && item === true) features.push(el);
  }

  return Banner({
    env: ENV,

    host: "localhost",

    port,

    url: `http://localhost:${port}`,

    apiPrefix: `/api/v${apiVersion}`,

    health: `/api/v${apiVersion}/health`,

    db: {
      driver: "MongoDB",
      name: databaseName || "starkForge",
      connected: true,
      status: appInfo.dbConnectionStatus
    },

    generated: {
      models: appInfo.modelsCount,
      validators: appInfo.validationsCount,
      routes: appInfo.routesCount,
    },

    features,

    resources,
  });
};

export default printInfo;
