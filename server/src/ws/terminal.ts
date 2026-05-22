import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import * as pty from "node-pty";
import * as os from "os";
import { verifyToken } from "../middleware/auth";
import {
  getServiceStates,
  getScrollback,
  writeToService,
  resizeService,
  subscribeToOutput,
  unsubscribeFromOutput,
  setStateChangeCallback,
} from "../services/serviceManager";
import { WsMessage } from "../../../shared/types";

const connectedClients = new Set<WebSocket>();

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
    if (!verifyToken(cookies.token || "")) {
      ws.close(4001, "Unauthorized");
      return;
    }

    connectedClients.add(ws);

    const shell = spawnShell(ws);

    const outputHandlers = new Map<string, (data: string) => void>();

    for (const svc of getServiceStates()) {
      const handler = (data: string) => {
        send(ws, { type: "output", id: svc.id, data });
      };
      outputHandlers.set(svc.id, handler);
      subscribeToOutput(svc.id, handler);
      const scrollback = getScrollback(svc.id);
      if (scrollback) send(ws, { type: "output", id: svc.id, data: scrollback });
    }

    send(ws, { type: "state", services: getServiceStates() });

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
        } else {
          writeToService(msg.id, msg.data);
        }
      } else if (msg.type === "resize") {
        if (msg.id === "shell") {
          shell.pty.resize(msg.cols, msg.rows);
        } else {
          resizeService(msg.id, msg.cols, msg.rows);
        }
      }
    });

    ws.on("close", () => {
      connectedClients.delete(ws);
      shell.pty.kill();
      for (const [id, handler] of outputHandlers) {
        unsubscribeFromOutput(id, handler);
      }
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
  const msg: WsMessage = { type: "state", services: getServiceStates() };
  const encoded = JSON.stringify(msg);
  for (const ws of connectedClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoded);
    }
  }
}
