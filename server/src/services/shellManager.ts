import * as pty from "node-pty";
import * as fs from "fs";
import * as zlib from "zlib";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { RestartPolicy, ShellState, ShellStatus } from "../../../shared/types";
import { createLogger, stripAnsi } from "../logger";

const logger = createLogger("shells");
const btopLog = createLogger("btop");

const SHELLS_DIR = path.join(os.homedir(), "shells");
const LOGS_DIR = path.join(SHELLS_DIR, "logs");
const RESTART_DELAY_MS = 3000;
const SCROLLBACK_LIMIT = 100 * 1024; // 100 KB per shell
const DEFAULT_LOG_FOLDER_LIMIT = 25 * 1024 * 1024; // 25 MB

interface ShellEntry {
  id: string;
  restartPolicy: RestartPolicy;
  group?: string;
  logFolderLimit: number;
  status: ShellStatus;
  pty: pty.IPty | null;
  manualStop: boolean;
  outputListeners: Set<(data: string) => void>;
  scrollback: string;
}

const shells = new Map<string, ShellEntry>();

interface BtopSession {
  pty: pty.IPty;
  scrollback: string;
  outputListeners: Set<(data: string) => void>;
}

let btopSession: BtopSession | null = null;

export function isBtopAvailable(): boolean {
  try { execSync("which btop", { stdio: "ignore" }); return true; } catch { return false; }
}

export function initBtop() {
  if (!isBtopAvailable()) return;

  btopLog.info("spawning btop");
  const proc = pty.spawn("btop", [], {
    name: "xterm-256color",
    cols: 220,
    rows: 50,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  btopSession = { pty: proc, scrollback: "", outputListeners: new Set() };

  proc.onData((data) => {
    if (!btopSession) return;
    btopSession.scrollback += data;
    if (btopSession.scrollback.length > SCROLLBACK_LIMIT) {
      btopSession.scrollback = btopSession.scrollback.slice(-SCROLLBACK_LIMIT);
    }
    for (const listener of btopSession.outputListeners) listener(data);
  });

  proc.onExit(({ exitCode }) => {
    btopLog.warn(`btop exited (code ${exitCode}), restarting in 1s`);
    btopSession = null;
    setTimeout(initBtop, 1000);
  });
}

export function getBtopScrollback(): string {
  return btopSession?.scrollback ?? "";
}

export function writeToBtop(data: string) {
  btopSession?.pty.write(data);
}

export function resizeBtop(cols: number, rows: number) {
  btopSession?.pty.resize(cols, rows);
}

export function subscribeToBtop(listener: (data: string) => void) {
  btopSession?.outputListeners.add(listener);
}

export function unsubscribeFromBtop(listener: (data: string) => void) {
  btopSession?.outputListeners.delete(listener);
}

let onStateChange: (() => void) | null = null;

export function setStateChangeCallback(cb: () => void) {
  onStateChange = cb;
}

function notifyStateChange() {
  onStateChange?.();
}

function parseRestartPolicy(scriptPath: string): RestartPolicy {
  try {
    const content = fs.readFileSync(scriptPath, "utf8");
    const match = content.match(/^#\s*restart:\s*(always|unless-stopped|never)/m);
    if (match) return match[1] as RestartPolicy;
  } catch {}
  return "unless-stopped";
}

function parseGroup(scriptPath: string): string | undefined {
  try {
    const content = fs.readFileSync(scriptPath, "utf8");
    const match = content.match(/^#\s*group:\s*(.+)/m);
    if (match) return match[1].trim();
  } catch {}
  return undefined;
}

function parseLogFolderLimit(scriptPath: string): number {
  try {
    const content = fs.readFileSync(scriptPath, "utf8");
    const match = content.match(/^#\s*log-folder-limit:\s*(\d+(?:\.\d+)?)\s*(mb|gb|kb)?/im);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = (match[2] ?? "mb").toLowerCase();
      if (unit === "kb") return Math.floor(value * 1024);
      if (unit === "gb") return Math.floor(value * 1024 * 1024 * 1024);
      return Math.floor(value * 1024 * 1024);
    }
  } catch {}
  return DEFAULT_LOG_FOLDER_LIMIT;
}

function logDir(id: string): string {
  return path.join(LOGS_DIR, id);
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
    `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function dirSize(dir: string): number {
  return fs.readdirSync(dir).reduce((total, file) => {
    try { return total + fs.statSync(path.join(dir, file)).size; } catch { return total; }
  }, 0);
}

function pruneLogDir(dir: string, limit: number) {
  const shellId = path.basename(dir);
  const files = fs.readdirSync(dir)
    .filter((f) => f !== "latest.log")
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  let size = dirSize(dir);
  for (const file of files) {
    if (size <= limit) break;
    const fp = path.join(dir, file.name);
    const fileSize = fs.statSync(fp).size;
    size -= fileSize;
    fs.unlinkSync(fp);
    logger.debug(`[${shellId}] pruned log ${file.name} (${(fileSize / 1024).toFixed(1)} KB freed, ${(size / 1024 / 1024).toFixed(2)} MB remaining)`);
  }
}

function rotateLogs(id: string, limit: number): Promise<void> {
  const dir = logDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const latest = path.join(dir, "latest.log");
  if (!fs.existsSync(latest)) return Promise.resolve();
  if (fs.statSync(latest).size === 0) {
    fs.unlinkSync(latest);
    return Promise.resolve();
  }

  const shellId = path.basename(dir);
  const latestSize = fs.statSync(latest).size;
  return new Promise((resolve) => {
    const destName = `${timestamp()}.log.gz`;
    const dest = path.join(dir, destName);
    logger.debug(`[${shellId}] rotating latest.log (${(latestSize / 1024).toFixed(1)} KB) -> ${destName}`);
    const src = fs.createReadStream(latest);
    const gz = zlib.createGzip();
    const out = fs.createWriteStream(dest);
    src.pipe(gz).pipe(out);
    out.on("finish", () => {
      fs.unlinkSync(latest);
      pruneLogDir(dir, limit);
      logger.info(`[${shellId}] log rotated -> ${destName}`);
      resolve();
    });
    out.on("error", (err) => {
      logger.error(`[${shellId}] log rotation failed: ${err.message}`);
      resolve(); // don't block spawn on compression failure
    });
  });
}

async function openLogStream(id: string, limit: number): Promise<fs.WriteStream> {
  const dir = logDir(id);
  fs.mkdirSync(dir, { recursive: true });
  await rotateLogs(id, limit);
  return fs.createWriteStream(path.join(dir, "latest.log"), { flags: "a" });
}

async function spawnShell(entry: ShellEntry) {
  const scriptPath = path.join(SHELLS_DIR, `${entry.id}.sh`);
  if (!fs.existsSync(scriptPath)) {
    logger.error(`[${entry.id}] script not found: ${scriptPath}`);
    return;
  }

  entry.restartPolicy = parseRestartPolicy(scriptPath);
  entry.group = parseGroup(scriptPath);
  entry.logFolderLimit = parseLogFolderLimit(scriptPath);

  const logStream = await openLogStream(entry.id, entry.logFolderLimit);

  logger.info(`[${entry.id}] spawning (policy=${entry.restartPolicy}${entry.group ? `, group=${entry.group}` : ""})`);

  const proc = pty.spawn("bash", ["-l", scriptPath], {
    name: "xterm-256color",
    cols: 220,
    rows: 50,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  entry.scrollback = "";
  entry.pty = proc;
  entry.status = "running";
  logger.info(`[${entry.id}] started (pid=${proc.pid})`);
  notifyStateChange();

  proc.onData((data) => {
    logStream.write(stripAnsi(data));
    entry.scrollback += data;
    if (entry.scrollback.length > SCROLLBACK_LIMIT) {
      entry.scrollback = entry.scrollback.slice(-SCROLLBACK_LIMIT);
    }
    for (const listener of entry.outputListeners) {
      listener(data);
    }
  });

  proc.onExit(({ exitCode }) => {
    logStream.end();
    entry.pty = null;
    const crashed = exitCode !== 0 && !entry.manualStop;
    entry.status = crashed ? "crashed" : "stopped";

    if (crashed) {
      logger.warn(`[${entry.id}] crashed (exit code ${exitCode})`);
    } else {
      logger.info(`[${entry.id}] stopped (exit code ${exitCode})`);
    }

    notifyStateChange();

    const shouldRestart =
      entry.restartPolicy === "always" ||
      (entry.restartPolicy === "unless-stopped" && !entry.manualStop);

    if (shouldRestart) {
      logger.info(`[${entry.id}] scheduling restart in ${RESTART_DELAY_MS}ms`);
      setTimeout(() => {
        entry.manualStop = false;
        spawnShell(entry);
      }, RESTART_DELAY_MS);
    } else {
      logger.debug(`[${entry.id}] no restart (policy=${entry.restartPolicy}, manualStop=${entry.manualStop})`);
    }
  });
}

export function initShells() {
  initBtop();
  fs.mkdirSync(LOGS_DIR, { recursive: true }); // ensure base logs dir exists

  if (!fs.existsSync(SHELLS_DIR)) {
    fs.mkdirSync(SHELLS_DIR, { recursive: true });
    return;
  }

  const scripts = fs
    .readdirSync(SHELLS_DIR)
    .filter((f) => f.endsWith(".sh"))
    .map((f) => f.replace(/\.sh$/, ""));

  logger.info(`discovered ${scripts.length} shell script(s): ${scripts.join(", ") || "(none)"}`);

  for (const id of scripts) {
    const scriptPath = path.join(SHELLS_DIR, `${id}.sh`);
    const entry: ShellEntry = {
      id,
      restartPolicy: parseRestartPolicy(scriptPath),
      group: parseGroup(scriptPath),
      logFolderLimit: parseLogFolderLimit(scriptPath),
      status: "stopped",
      pty: null,
      manualStop: false,
      outputListeners: new Set(),
      scrollback: "",
    };
    shells.set(id, entry);
    spawnShell(entry);
  }
}

export function getShellStates(): ShellState[] {
  return Array.from(shells.values()).map(({ id, status, restartPolicy, group }) => ({
    id,
    status,
    restartPolicy,
    ...(group !== undefined && { group }),
  }));
}

export function startShell(id: string): boolean {
  const entry = shells.get(id);
  if (!entry || entry.status === "running") return false;
  logger.info(`[${id}] manual start requested`);
  entry.manualStop = false;
  spawnShell(entry);
  return true;
}

export function stopShell(id: string): boolean {
  const entry = shells.get(id);
  if (!entry || entry.status !== "running" || !entry.pty) return false;
  logger.info(`[${id}] manual stop requested`);
  entry.manualStop = true;
  entry.pty.kill();
  return true;
}

export function restartShell(id: string): boolean {
  const entry = shells.get(id);
  if (!entry) return false;
  logger.info(`[${id}] manual restart requested`);
  entry.manualStop = false;
  if (entry.pty) {
    entry.pty.kill();
  } else {
    spawnShell(entry);
  }
  return true;
}

export function startAllShells() {
  logger.info("start-all requested");
  for (const entry of shells.values()) {
    if (entry.status !== "running") {
      entry.manualStop = false;
      spawnShell(entry);
    }
  }
}

export function stopAllShells() {
  logger.info("stop-all requested");
  for (const entry of shells.values()) {
    if (entry.status === "running" && entry.pty) {
      entry.manualStop = true;
      entry.pty.kill();
    }
  }
}

export function writeToShell(id: string, data: string) {
  shells.get(id)?.pty?.write(data);
}

export function resizeShell(id: string, cols: number, rows: number) {
  shells.get(id)?.pty?.resize(cols, rows);
}

export function getScrollback(id: string): string {
  return shells.get(id)?.scrollback ?? "";
}

export function subscribeToShellOutput(id: string, listener: (data: string) => void) {
  shells.get(id)?.outputListeners.add(listener);
}

export function unsubscribeFromShellOutput(id: string, listener: (data: string) => void) {
  shells.get(id)?.outputListeners.delete(listener);
}

export function getRunningShellPids(): Map<string, number> {
  const pids = new Map<string, number>();
  for (const [id, entry] of shells) {
    if (entry.status === "running" && entry.pty) {
      pids.set(id, entry.pty.pid);
    }
  }
  return pids;
}
