import * as pty from "node-pty";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { RestartPolicy, ServiceState, ServiceStatus } from "../../../shared/types";

const SERVICES_DIR = path.join(os.homedir(), "services");
const LOGS_DIR = path.join(SERVICES_DIR, "logs");
const RESTART_DELAY_MS = 3000;
const SCROLLBACK_LIMIT = 100 * 1024; // 100 KB per service

interface ServiceEntry {
  id: string;
  restartPolicy: RestartPolicy;
  group?: string;
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

function rotateLogs(id: string) {
  const latest = path.join(LOGS_DIR, `${id}.latest.log`);
  const previous = path.join(LOGS_DIR, `${id}.previous.log`);
  if (fs.existsSync(latest)) {
    fs.renameSync(latest, previous);
  }
}

function openLogStream(id: string): fs.WriteStream {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  rotateLogs(id);
  return fs.createWriteStream(path.join(LOGS_DIR, `${id}.latest.log`), { flags: "a" });
}

function spawnService(entry: ServiceEntry) {
  const scriptPath = path.join(SERVICES_DIR, `${entry.id}.sh`);
  if (!fs.existsSync(scriptPath)) return;

  entry.restartPolicy = parseRestartPolicy(scriptPath);
  entry.group = parseGroup(scriptPath);

  const logStream = openLogStream(entry.id);

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
  fs.mkdirSync(LOGS_DIR, { recursive: true });

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
