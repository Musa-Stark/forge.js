import type { RequestHandler } from "express";

const healthPatch: RequestHandler = (req, res) => {
  res.json({ success: true, message: "Patch request health 100%" });
};

export default healthPatch;
