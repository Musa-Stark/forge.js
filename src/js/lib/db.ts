import mongoose from "mongoose";
import AppLog from "../utils/AppLog.js";

const connectLocally = async (databaseName = "offline-db-ts") => {
  await mongoose.connect(`mongodb://localhost:27017/${databaseName}`);
  AppLog("check", "db", `Connected to OFFLINE-DB: '${databaseName}'`);
};

type connectDBParams = {
  isOffline: boolean;
  mongoDBURI: string | undefined;
  databaseName: string | undefined;
};

const connectDB = async ({
  isOffline,
  mongoDBURI,
  databaseName,
}: connectDBParams) => {
  try {
    if (isOffline) return connectLocally(databaseName);

    if (!isOffline && !mongoDBURI)
      throw new Error("You are online! mongoDBURI is required");

    if (!databaseName) throw new Error("databaseName is required");

    setTimeout(() => {
      AppLog("loading", "db", "Connecting to mongodb...");
    }, 10);

    await mongoose.connect(`${mongoDBURI}/${databaseName}`);
    AppLog("check", "db", "Connected successfully!");
  } catch (error) {
    AppLog("x", "db", "Error while connecting!");
    AppLog("x", "db", (error as Error).message);
  }
};

// export
export default connectDB;
