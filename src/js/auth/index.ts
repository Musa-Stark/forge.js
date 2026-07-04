import type { RequestHandler } from "express";

const auth: RequestHandler = (req, res) => {
  return res.json({ success: true, message: "Auth page found!" });
};

export default auth;
