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
  rescanShells,
  getShellStates,
} from "../services/shellManager";

const LOGS_DIR = path.join(os.homedir(), "shells", "logs");

const router = Router();

router.get("/shells", (req: Request, res: Response) => {
  res.json(getShellStates());
});

router.post("/shells/rescan", (req: Request, res: Response) => {
  rescanShells();
  res.json({ ok: true });
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
      // latest.log always first, then newest -> oldest
      if (a.name === "latest.log") return -1;
      if (b.name === "latest.log") return 1;
      return b.mtime - a.mtime;
    });

  res.json(files);
});

const LOG_TAIL_LINES = 5000;

function validateLogFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("..");
}

router.get("/shells/:id/logs/:filename/download", (req: Request, res: Response) => {
  const { id, filename } = req.params;
  if (!validateLogFilename(filename)) { res.status(400).end(); return; }

  const filepath = path.join(LOGS_DIR, id, filename);
  if (!fs.existsSync(filepath)) { res.status(404).end(); return; }

  const mime = filename.endsWith(".gz") ? "application/gzip" : "text/plain; charset=utf-8";
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", mime);
  fs.createReadStream(filepath).pipe(res);
});

router.get("/shells/:id/logs/:filename", (req: Request, res: Response) => {
  const { id, filename } = req.params;
  if (!validateLogFilename(filename)) { res.status(400).end(); return; }

  const filepath = path.join(LOGS_DIR, id, filename);
  if (!fs.existsSync(filepath)) { res.status(404).end(); return; }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  if (filename.endsWith(".gz")) {
    const lines: string[] = [];
    let remainder = "";

    const gunzip = zlib.createGunzip();
    const src = fs.createReadStream(filepath);

    gunzip.on("data", (chunk: Buffer) => {
      const text = remainder + chunk.toString("utf8");
      const parts = text.split("\n");
      remainder = parts.pop()!;
      lines.push(...parts);
      if (lines.length > LOG_TAIL_LINES * 2) lines.splice(0, lines.length - LOG_TAIL_LINES);
    });

    gunzip.on("end", () => {
      if (remainder) lines.push(remainder);
      const truncated = lines.length > LOG_TAIL_LINES;
      const tail = truncated ? lines.slice(-LOG_TAIL_LINES) : lines;
      if (truncated) res.setHeader("X-Truncated", "true");
      res.end(tail.join("\n"));
    });

    gunzip.on("error", () => res.status(500).end());
    src.pipe(gunzip);
  } else {
    fs.createReadStream(filepath).pipe(res);
  }
});

export default router;
