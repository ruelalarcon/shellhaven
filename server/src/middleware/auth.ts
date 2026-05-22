import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getConfig } from "../config";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();
  if (!config) {
    res.status(401).json({ error: "Not configured." });
    return;
  }

  const token = req.cookies?.sh_session;
  if (!token) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized." });
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
