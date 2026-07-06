import type { RequestHandler } from "express";

const healthDelete: RequestHandler = (req, res) => {
  res.json({ success: true, message: "Delete request health 100%" });
};

export default healthDelete;
