import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getConfig, saveConfig } from "../config";

const router = Router();

router.get("/setup", (req: Request, res: Response) => {
  if (getConfig()) {
    res.redirect("/");
    return;
  }
  res.send(setupPage());
});

router.post("/setup", async (req: Request, res: Response) => {
  if (getConfig()) {
    res.redirect("/");
    return;
  }
  const { password, confirm } = req.body as { password: string; confirm: string };
  if (!password || password !== confirm || password.length < 8) {
    res.send(setupPage("Passwords must match and be at least 8 characters."));
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const jwtSecret = crypto.randomBytes(64).toString("hex");
  saveConfig({ passwordHash, jwtSecret });
  res.redirect("/login");
});

router.get("/login", (req: Request, res: Response) => {
  if (!getConfig()) {
    res.redirect("/setup");
    return;
  }
  res.send(loginPage());
});

router.post("/login", async (req: Request, res: Response) => {
  const config = getConfig();
  if (!config) {
    res.redirect("/setup");
    return;
  }
  const { password } = req.body as { password: string };
  const valid = await bcrypt.compare(password || "", config.passwordHash);
  if (!valid) {
    res.send(loginPage("Invalid password."));
    return;
  }
  const token = jwt.sign({}, config.jwtSecret, { expiresIn: "7d" });
  res.cookie("td_session", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "strict",
  });
  res.redirect("/");
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("td_session");
  res.redirect("/login");
});

function setupPage(error?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup — Terminal Dashboard</title>
<style>
  body { font-family: monospace; background: #1a1a1a; color: #e0e0e0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #2a2a2a; border: 1px solid #444; padding: 2rem; width: 320px; }
  h1 { margin: 0 0 1.5rem; font-size: 1.2rem; }
  label { display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: #aaa; }
  input { width: 100%; box-sizing: border-box; background: #111; border: 1px solid #555; color: #e0e0e0; padding: 0.5rem; font-family: monospace; margin-bottom: 1rem; }
  button { width: 100%; padding: 0.6rem; background: #3a7fd4; color: white; border: none; cursor: pointer; font-family: monospace; }
  button:hover { background: #4a8fe4; }
  .error { color: #e06c75; margin-bottom: 1rem; font-size: 0.85rem; }
</style>
</head>
<body>
<div class="box">
  <h1>Terminal Dashboard Setup</h1>
  ${error ? `<div class="error">${error}</div>` : ""}
  <form method="POST" action="/setup">
    <label>Password</label>
    <input type="password" name="password" autofocus required>
    <label>Confirm Password</label>
    <input type="password" name="confirm" required>
    <button type="submit">Set Password</button>
  </form>
</div>
</body>
</html>`;
}

function loginPage(error?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — Terminal Dashboard</title>
<style>
  body { font-family: monospace; background: #1a1a1a; color: #e0e0e0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #2a2a2a; border: 1px solid #444; padding: 2rem; width: 320px; }
  h1 { margin: 0 0 1.5rem; font-size: 1.2rem; }
  label { display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: #aaa; }
  input { width: 100%; box-sizing: border-box; background: #111; border: 1px solid #555; color: #e0e0e0; padding: 0.5rem; font-family: monospace; margin-bottom: 1rem; }
  button { width: 100%; padding: 0.6rem; background: #3a7fd4; color: white; border: none; cursor: pointer; font-family: monospace; }
  button:hover { background: #4a8fe4; }
  .error { color: #e06c75; margin-bottom: 1rem; font-size: 0.85rem; }
</style>
</head>
<body>
<div class="box">
  <h1>Terminal Dashboard</h1>
  ${error ? `<div class="error">${error}</div>` : ""}
  <form method="POST" action="/login">
    <label>Password</label>
    <input type="password" name="password" autofocus required>
    <button type="submit">Login</button>
  </form>
</div>
</body>
</html>`;
}

export default router;
