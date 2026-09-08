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
  refresh,
} from "../auth/bunch.auth.js";

// account handlers
import { getMe, updateMe, deleteMe } from "../account/bunch.account.js";

// crud handlers
import {
  read,
  create,
  readAll,
  createBulk,
  remove,
  removeMultiple,
  removeAll,
  update,
  updateFile,
  deleteFile,
  addFile,
} from "../crud/bunch.crud.js";

// admin handlers
import { checkAdmin } from "../admin/bunch.admin.js";

const handlerMap: Record<string, any> = {
  // health
  healthDelete,
  healthGet,
  healthPatch,
  healthPost,
  healthPut,

  // auth
  signup,
  verifyOTP,
  login,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
  refresh,

  // crud
  read,
  create,
  readAll,
  createBulk,
  remove,
  removeMultiple,
  removeAll,
  update,
  updateFile,
  deleteFile,
  addFile,
  getMe,
  updateMe,
  deleteMe,

  // admin
  checkAdmin,
};

export default handlerMap;
