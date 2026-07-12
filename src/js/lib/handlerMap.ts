import {
  healthDelete,
  healthGet,
  healthPatch,
  healthPost,
  healthPut,
} from "../health/bunch.health.js";

import {
  signup,
  verifyOTP,
  login,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
} from "../auth/bunch.auth.js";

const handlerMap: Record<string, any> = {
  healthDelete,
  healthGet,
  healthPatch,
  healthPost,
  healthPut,
  signup,
  verifyOTP,
  login,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
};

export default handlerMap;
