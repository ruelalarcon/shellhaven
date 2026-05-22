import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getConfig } from "../config";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();
  if (!config) {
    res.redirect("/setup");
    return;
  }

  const token = req.cookies?.token;
  if (!token) {
    res.redirect("/login");
    return;
  }

  try {
    jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.redirect("/login");
  }
}

export function verifyToken(token: string): boolean {
  const config = getConfig();
  if (!config) return false;
  try {
    jwt.verify(token, config.jwtSecret);
    return true;
  } catch {
    return false;
  }
}
