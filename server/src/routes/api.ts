import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as zlib from "zlib";
import {
  startShell,
  stopShell,
  restartShell,
  startAllShells,
  stopAllShells,
  getShellStates,
} from "../services/shellManager";

const LOGS_DIR = path.join(os.homedir(), "shells", "logs");

const router = Router();

router.get("/shells", (req: Request, res: Response) => {
  res.json(getShellStates());
});

router.post("/shells/start-all", (req: Request, res: Response) => {
  startAllShells();
  res.json({ ok: true });
});

router.post("/shells/stop-all", (req: Request, res: Response) => {
  stopAllShells();
  res.json({ ok: true });
});

router.post("/shells/:id/start", (req: Request, res: Response) => {
  const ok = startShell(req.params.id);
  res.json({ ok });
});

router.post("/shells/:id/stop", (req: Request, res: Response) => {
  const ok = stopShell(req.params.id);
  res.json({ ok });
});

router.post("/shells/:id/restart", (req: Request, res: Response) => {
  const ok = restartShell(req.params.id);
  res.json({ ok });
});

router.get("/shells/:id/logs", (req: Request, res: Response) => {
  const dir = path.join(LOGS_DIR, req.params.id);
  if (!fs.existsSync(dir)) { res.json([]); return; }

  const files = fs.readdirSync(dir)
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => {
      // latest.log always first, then newest → oldest
      if (a.name === "latest.log") return -1;
      if (b.name === "latest.log") return 1;
      return b.mtime - a.mtime;
    });

  res.json(files);
});

router.get("/shells/:id/logs/:filename", (req: Request, res: Response) => {
  const { id, filename } = req.params;
  // prevent path traversal
  if (filename.includes("/") || filename.includes("..")) { res.status(400).end(); return; }

  const filepath = path.join(LOGS_DIR, id, filename);
  if (!fs.existsSync(filepath)) { res.status(404).end(); return; }

  if (filename.endsWith(".gz")) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    fs.createReadStream(filepath).pipe(zlib.createGunzip()).pipe(res);
  } else {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    fs.createReadStream(filepath).pipe(res);
  }
});

export default router;
