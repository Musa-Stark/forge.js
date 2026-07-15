import createOTPUser from "./createOTPUser.js";
import createUser from "./createUser.js";
import authenticateUser from "./authenticateUser.js";

const modeMap = {
  signup: {
    otp: createOTPUser,
    credentials: createUser,
  },
  login: {
    otp: createOTPUser,
    credentials: authenticateUser,
  },
};

export default modeMap;
