import type { RequestHandler } from "express";

const healthPut: RequestHandler = (req, res) => {
  res.json({ success: true, message: "Put request health 100%" });
};

export default healthPut;
