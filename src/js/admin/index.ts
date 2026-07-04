import type { RequestHandler } from "express";

const admin: RequestHandler = (req, res) => {
  return res.json({ success: true, message: "Admin page found!" });
};

export default admin