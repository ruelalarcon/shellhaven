import * as pty from "node-pty";
import * as fs from "fs";
import * as zlib from "zlib";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { RestartPolicy, ServiceState, ServiceStatus } from "../../../shared/types";

const SERVICES_DIR = path.join(os.homedir(), "services");
const LOGS_DIR = path.join(SERVICES_DIR, "logs");
const RESTART_DELAY_MS = 3000;
const SCROLLBACK_LIMIT = 100 * 1024; // 100 KB per service
const DEFAULT_LOG_FOLDER_LIMIT = 25 * 1024 * 1024; // 25 MB

interface ServiceEntry {
  id: string;
  restartPolicy: RestartPolicy;
  group?: string;
  logFolderLimit: number;
  status: ServiceStatus;
  pty: pty.IPty | null;
  manualStop: boolean;
  outputListeners: Set<(data: string) => void>;
  scrollback: string;
}

const services = new Map<string, ServiceEntry>();

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

  proc.onExit(() => {
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
  const files = fs.readdirSync(dir)
    .filter((f) => f !== "latest.log")
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  let size = dirSize(dir);
  for (const file of files) {
    if (size <= limit) break;
    const fp = path.join(dir, file.name);
    size -= fs.statSync(fp).size;
    fs.unlinkSync(fp);
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

  return new Promise((resolve) => {
    const dest = path.join(dir, `${timestamp()}.log.gz`);
    const src = fs.createReadStream(latest);
    const gz = zlib.createGzip();
    const out = fs.createWriteStream(dest);
    src.pipe(gz).pipe(out);
    out.on("finish", () => {
      fs.unlinkSync(latest);
      pruneLogDir(dir, limit);
      resolve();
    });
    out.on("error", () => resolve()); // don't block spawn on compression failure
  });
}

async function openLogStream(id: string, limit: number): Promise<fs.WriteStream> {
  const dir = logDir(id);
  fs.mkdirSync(dir, { recursive: true });
  await rotateLogs(id, limit);
  return fs.createWriteStream(path.join(dir, "latest.log"), { flags: "a" });
}

async function spawnService(entry: ServiceEntry) {
  const scriptPath = path.join(SERVICES_DIR, `${entry.id}.sh`);
  if (!fs.existsSync(scriptPath)) return;

  entry.restartPolicy = parseRestartPolicy(scriptPath);
  entry.group = parseGroup(scriptPath);
  entry.logFolderLimit = parseLogFolderLimit(scriptPath);

  const logStream = await openLogStream(entry.id, entry.logFolderLimit);

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
  notifyStateChange();

  proc.onData((data) => {
    logStream.write(data);
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
    notifyStateChange();

    const shouldRestart =
      entry.restartPolicy === "always" ||
      (entry.restartPolicy === "unless-stopped" && !entry.manualStop);

    if (shouldRestart) {
      setTimeout(() => {
        entry.manualStop = false;
        spawnService(entry);
      }, RESTART_DELAY_MS);
    }
  });
}

export function initServices() {
  initBtop();
  fs.mkdirSync(LOGS_DIR, { recursive: true }); // ensure base logs dir exists

  if (!fs.existsSync(SERVICES_DIR)) {
    fs.mkdirSync(SERVICES_DIR, { recursive: true });
    return;
  }

  const scripts = fs
    .readdirSync(SERVICES_DIR)
    .filter((f) => f.endsWith(".sh"))
    .map((f) => f.replace(/\.sh$/, ""));

  for (const id of scripts) {
    const scriptPath = path.join(SERVICES_DIR, `${id}.sh`);
    const entry: ServiceEntry = {
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
    services.set(id, entry);
    spawnService(entry);
  }
}

export function getServiceStates(): ServiceState[] {
  return Array.from(services.values()).map(({ id, status, restartPolicy, group }) => ({
    id,
    status,
    restartPolicy,
    ...(group !== undefined && { group }),
  }));
}

export function startService(id: string): boolean {
  const entry = services.get(id);
  if (!entry || entry.status === "running") return false;
  entry.manualStop = false;
  spawnService(entry);
  return true;
}

export function stopService(id: string): boolean {
  const entry = services.get(id);
  if (!entry || entry.status !== "running" || !entry.pty) return false;
  entry.manualStop = true;
  entry.pty.kill();
  return true;
}

export function restartService(id: string): boolean {
  const entry = services.get(id);
  if (!entry) return false;
  entry.manualStop = false;
  if (entry.pty) {
    entry.pty.kill();
  } else {
    spawnService(entry);
  }
  return true;
}

export function startAll() {
  for (const entry of services.values()) {
    if (entry.status !== "running") {
      entry.manualStop = false;
      spawnService(entry);
    }
  }
}

export function stopAll() {
  for (const entry of services.values()) {
    if (entry.status === "running" && entry.pty) {
      entry.manualStop = true;
      entry.pty.kill();
    }
  }
}

export function writeToService(id: string, data: string) {
  services.get(id)?.pty?.write(data);
}

export function resizeService(id: string, cols: number, rows: number) {
  services.get(id)?.pty?.resize(cols, rows);
}

export function getScrollback(id: string): string {
  return services.get(id)?.scrollback ?? "";
}

export function subscribeToOutput(id: string, listener: (data: string) => void) {
  services.get(id)?.outputListeners.add(listener);
}

export function unsubscribeFromOutput(id: string, listener: (data: string) => void) {
  services.get(id)?.outputListeners.delete(listener);
}

export function getRunningPids(): Map<string, number> {
  const pids = new Map<string, number>();
  for (const [id, entry] of services) {
    if (entry.status === "running" && entry.pty) {
      pids.set(id, entry.pty.pid);
    }
  }
  return pids;
}
