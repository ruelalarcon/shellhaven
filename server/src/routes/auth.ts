import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { getConfig, saveConfig } from "../config";
import { verifyToken } from "../middleware/auth";
import { isBtopAvailable } from "../services/shellManager";

const router = Router();

router.get("/api/status", (req: Request, res: Response) => {
  const config = getConfig();
  const configured = config !== null;
  const authenticated = configured && verifyToken(req.cookies?.sh_session ?? "");
  res.json({ configured, authenticated, btop: isBtopAvailable() });
});

const spa = (res: Response) =>
  res.sendFile(path.join(__dirname, "../../../client/dist/index.html"));

router.get("/setup", (req: Request, res: Response) => {
  if (getConfig()) { res.redirect("/"); return; }
  spa(res);
});

router.get("/login", (req: Request, res: Response) => {
  if (!getConfig()) { res.redirect("/#/setup"); return; }
  spa(res);
});

router.post("/setup", async (req: Request, res: Response) => {
  if (getConfig()) { res.status(409).json({ error: "Already configured." }); return; }
  const { password, confirm } = req.body as { password: string; confirm: string };
  if (!password || password !== confirm || password.length < 8) {
    res.status(400).json({ error: "Passwords must match and be at least 8 characters." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const jwtSecret = crypto.randomBytes(64).toString("hex");
  saveConfig({ passwordHash, jwtSecret });
  res.json({ ok: true });
});

router.post("/login", async (req: Request, res: Response) => {
  const config = getConfig();
  if (!config) { res.status(400).json({ error: "Not configured." }); return; }
  const { password } = req.body as { password: string };
  const valid = await bcrypt.compare(password || "", config.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid password." }); return; }
  const token = jwt.sign({}, config.jwtSecret, { expiresIn: "7d" });
  res.cookie("sh_session", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "strict",
  });
  res.json({ ok: true });
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("sh_session");
  res.json({ ok: true });
});

export default router;
