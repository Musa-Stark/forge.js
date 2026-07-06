import type { RequestHandler } from "express";

const healthGet: RequestHandler = (req, res) => {
  res.json({ success: true, message: "Get request health 100%" });
};

export default healthGet;
