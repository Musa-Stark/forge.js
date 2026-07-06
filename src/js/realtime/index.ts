import type { RequestHandler } from "express";

const realtime: RequestHandler = (req, res) => {
  return res.json({ success: true, message: "realtime page found!" });
};

export default realtime;
