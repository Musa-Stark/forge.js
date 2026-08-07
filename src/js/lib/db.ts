import mongoose from "mongoose";
import AppLog from "../utils/AppLog.js";

const connectLocally = async (databaseName = "starkForge") => {
  try {
    await mongoose.connect(`mongodb://localhost:27017/${databaseName}`);
  } catch (error) {
    AppLog("x", "db", (error as Error).message);
    AppLog("x", "db", "Error while connecting to database! Check if MongoDB is installed locally and is enabled.");
    process.exit(1);
  }

  AppLog(
    "check",
    "db",
    `Connected to OFFLINE-DB! Database name: '${databaseName}'`,
  );
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

    if (!databaseName) databaseName = "starkForge";

    setTimeout(() => {
      AppLog("loading", "db", "Connecting to mongodb...");
    }, 10);

    await mongoose.connect(`${mongoDBURI}/${databaseName}`);
    AppLog(
      "check",
      "db",
      `Connected successfully! Database name: '${databaseName}'`,
    );
  } catch (error) {
    AppLog("x", "db", "Error while connecting to database!");
    AppLog("x", "db", (error as Error).message);
    process.exit(1);
  }
};

// export
export default connectDB;
