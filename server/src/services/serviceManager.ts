import * as pty from "node-pty";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { RestartPolicy, ServiceState, ServiceStatus } from "../../../shared/types";

const SERVICES_DIR = path.join(os.homedir(), "services");
const LOGS_DIR = path.join(SERVICES_DIR, "logs");
const RESTART_DELAY_MS = 3000;

interface ServiceEntry {
  id: string;
  restartPolicy: RestartPolicy;
  status: ServiceStatus;
  pty: pty.IPty | null;
  manualStop: boolean;
  outputListeners: Set<(data: string) => void>;
}

const services = new Map<string, ServiceEntry>();

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

  const logStream = openLogStream(entry.id);

  const proc = pty.spawn("bash", ["-l", scriptPath], {
    name: "xterm-256color",
    cols: 220,
    rows: 50,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  entry.pty = proc;
  entry.status = "running";
  notifyStateChange();

  proc.onData((data) => {
    logStream.write(data);
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
      status: "stopped",
      pty: null,
      manualStop: false,
      outputListeners: new Set(),
    };
    services.set(id, entry);
    spawnService(entry);
  }
}

export function getServiceStates(): ServiceState[] {
  return Array.from(services.values()).map(({ id, status, restartPolicy }) => ({
    id,
    status,
    restartPolicy,
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

export function subscribeToOutput(id: string, listener: (data: string) => void) {
  services.get(id)?.outputListeners.add(listener);
}

export function unsubscribeFromOutput(id: string, listener: (data: string) => void) {
  services.get(id)?.outputListeners.delete(listener);
}
