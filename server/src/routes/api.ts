import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as zlib from "zlib";
import {
  startService,
  stopService,
  restartService,
  startAll,
  stopAll,
  getServiceStates,
} from "../services/serviceManager";

const LOGS_DIR = path.join(os.homedir(), "services", "logs");

const router = Router();

router.get("/services", (req: Request, res: Response) => {
  res.json(getServiceStates());
});

router.post("/services/start-all", (req: Request, res: Response) => {
  startAll();
  res.json({ ok: true });
});

router.post("/services/stop-all", (req: Request, res: Response) => {
  stopAll();
  res.json({ ok: true });
});

router.post("/services/:id/start", (req: Request, res: Response) => {
  const ok = startService(req.params.id);
  res.json({ ok });
});

router.post("/services/:id/stop", (req: Request, res: Response) => {
  const ok = stopService(req.params.id);
  res.json({ ok });
});

router.post("/services/:id/restart", (req: Request, res: Response) => {
  const ok = restartService(req.params.id);
  res.json({ ok });
});

router.get("/services/:id/logs", (req: Request, res: Response) => {
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

router.get("/services/:id/logs/:filename", (req: Request, res: Response) => {
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
