import {
  healthDelete,
  healthGet,
  healthPatch,
  healthPost,
  healthPut,
} from "../health/bunch.health.js";

import { signup, verifyOTP, login, resendOTP } from "../auth/bunch.auth.js";

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
};

export default handlerMap;
