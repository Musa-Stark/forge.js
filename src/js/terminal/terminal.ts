import Banner from "./logger.js";
import { getEnvs } from "../config/envs.js";
import { collectionInfo, resources } from "./collectionInfo.js";
import type { CollectionInfo } from "./collectionInfo.ts";

const printInfo = () => {
  const { apiVersion, ENV, port, databaseName } = getEnvs();
  const features = [];

  const infokeys = Object.keys(collectionInfo) as [keyof CollectionInfo];
  for (const el of infokeys) {
    const item = collectionInfo[el];
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
    },

    generated: {
      models: collectionInfo.modelsCount,
      validators: collectionInfo.validationsCount,
      routes: collectionInfo.routesCount,
    },

    features,

    resources,
  });
};

export default printInfo;
