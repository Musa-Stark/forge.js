// health handlers
import {
  healthDelete,
  healthGet,
  healthPatch,
  healthPost,
  healthPut,
} from "../health/bunch.health.js";

// auth handlers
import {
  signup,
  verifyOTP,
  login,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
  refresh
} from "../auth/bunch.auth.js";

// crud handlers
import {
  read,
  create,
  readAll,
  createBulk,
  remove,
  removeAll,
  update,
  updateFile,
  deleteFile,
  addFile,
} from "../crud/bunch.crud.js";

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
  refresh,
  read,
  create,
  readAll,
  createBulk,
  remove,
  removeAll,
  update,
  updateFile,
  deleteFile,
  addFile,
};

export default handlerMap;
