import type { RequestHandler } from "express";

const upload: RequestHandler = (req, res) => {
  return res.json({ success: true, message: "upload page found!" });
};

export default upload;
