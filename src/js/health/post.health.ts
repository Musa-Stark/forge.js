import type { RequestHandler } from "express";

const healthPost: RequestHandler = (req, res) => {
  res.json({ success: true, message: "Post request health 100%" });
};

export default healthPost;
