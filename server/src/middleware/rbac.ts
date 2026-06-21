import type { NextFunction, Request, Response } from "express";
import type { RoleName } from "../generated/prisma/index.js";

export function requireRole(allowed: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.auth?.roles ?? [];
    if (!roles.some((role) => allowed.includes(role as RoleName))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
