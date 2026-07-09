import createOTPUser from "./createOTPUser.js";
import createUser from "./createUser.js";

const modeMap = {
  otp: createOTPUser,
  credentials: createUser,
};

export default modeMap;
