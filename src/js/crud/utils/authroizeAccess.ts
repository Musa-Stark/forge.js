import type { Request, Response, NextFunction } from "express";

const authorizeAccess = (authRole: string, method: string) => {
  const authMap = {
    public: [undefined, "user", "admin"],
    authenticated: ["user", "admin"],
    admin: ["admin"],
    adminOrOwner: ["user", "admin"],
  };
  return (req: Request, res: Response, next: NextFunction) => {
    if (authRole === "authenticated" && method) console.log(req.user.role);
    console.log(authRole);
    next();
  };
};

export default authorizeAccess;
