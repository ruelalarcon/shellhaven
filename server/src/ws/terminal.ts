import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import * as pty from "node-pty";
import * as os from "os";
import pidusage from "pidusage";
import { verifyToken } from "../middleware/auth";
import {
  getShellStates,
  getScrollback,
  writeToShell,
  resizeShell,
  subscribeToShellOutput,
  unsubscribeFromShellOutput,
  setStateChangeCallback,
  isBtopAvailable,
  getBtopScrollback,
  writeToBtop,
  resizeBtop,
  subscribeToBtop,
  unsubscribeFromBtop,
  getRunningShellPids,
} from "../services/shellManager";
import { ShellStats, WsMessage } from "../../../shared/types";

const connectedClients = new Set<WebSocket>();

const STATS_INTERVAL_MS = 2000;

async function broadcastStats() {
  const pids = getRunningShellPids();
  if (pids.size === 0 || connectedClients.size === 0) return;

  try {
    const pidArray = Array.from(pids.values());
    const usage = await pidusage(pidArray);
    const stats: Record<string, ShellStats> = {};
    for (const [id, pid] of pids) {
      const u = usage[pid];
      if (u) stats[id] = { cpu: u.cpu, mem: u.memory };
    }
    const msg: WsMessage = { type: "stats", stats };
    const encoded = JSON.stringify(msg);
    for (const ws of connectedClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(encoded);
    }
  } catch {
    // ignore pidusage errors (process may have exited between sample and read)
  }
}

setInterval(broadcastStats, STATS_INTERVAL_MS);

interface ShellSession {
  pty: pty.IPty;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    if (key) cookies[key.trim()] = decodeURIComponent(val.join("=").trim());
  }
  return cookies;
}

export function setupWebSocket(wss: WebSocketServer) {
  setStateChangeCallback(broadcastState);

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const cookies = parseCookies(req.headers.cookie || "");
    if (!verifyToken(cookies.sh_session || "")) {
      ws.close(4001, "Unauthorized");
      return;
    }

    connectedClients.add(ws);

    const shell = spawnShell(ws);

    const outputHandlers = new Map<string, (data: string) => void>();

    for (const svc of getShellStates()) {
      const handler = (data: string) => {
        send(ws, { type: "output", id: svc.id, data });
      };
      outputHandlers.set(svc.id, handler);
      subscribeToShellOutput(svc.id, handler);
    }

    let btopHandler: ((data: string) => void) | null = null;
    if (isBtopAvailable()) {
      btopHandler = (data: string) => send(ws, { type: "output", id: "btop", data });
      subscribeToBtop(btopHandler);
    }

    send(ws, { type: "state", shells: getShellStates() });

    ws.on("message", (raw) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString()) as WsMessage;
      } catch {
        return;
      }

      if (msg.type === "input") {
        if (msg.id === "shell") {
          shell.pty.write(msg.data);
        } else if (msg.id === "btop") {
          writeToBtop(msg.data);
        } else {
          writeToShell(msg.id, msg.data);
        }
      } else if (msg.type === "resize") {
        if (msg.id === "shell") {
          shell.pty.resize(msg.cols, msg.rows);
        } else if (msg.id === "btop") {
          resizeBtop(msg.cols, msg.rows);
        } else {
          resizeShell(msg.id, msg.cols, msg.rows);
        }
      } else if (msg.type === "get-scrollback") {
        const scrollback = msg.id === "btop" ? getBtopScrollback() : getScrollback(msg.id);
        if (scrollback) send(ws, { type: "output", id: msg.id, data: scrollback });
      } else if (msg.type === "get-state") {
        send(ws, { type: "state", shells: getShellStates() });
      }
    });

    ws.on("close", () => {
      connectedClients.delete(ws);
      shell.pty.kill();
      for (const [id, handler] of outputHandlers) {
        unsubscribeFromShellOutput(id, handler);
      }
      if (btopHandler) unsubscribeFromBtop(btopHandler);
    });
  });
}

function spawnShell(ws: WebSocket): ShellSession {
  const proc = pty.spawn("bash", ["-l"], {
    name: "xterm-256color",
    cols: 220,
    rows: 50,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

  proc.onData((data) => {
    send(ws, { type: "output", id: "shell", data });
  });

  return { pty: proc };
}

function send(ws: WebSocket, msg: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function broadcastState() {
  const msg: WsMessage = { type: "state", shells: getShellStates() };
  const encoded = JSON.stringify(msg);
  for (const ws of connectedClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoded);
    }
  }
}
