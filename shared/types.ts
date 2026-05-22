export type RestartPolicy = "always" | "unless-stopped" | "never";

export type ShellStatus = "running" | "stopped" | "crashed";

export interface ShellState {
  id: string;
  status: ShellStatus;
  restartPolicy: RestartPolicy;
  group?: string;
}

export interface LogEntry {
  name: string;
  size: number;
  mtime: number;
}

export interface ShellStats {
  cpu: number;   // percent, 0-100
  mem: number;   // bytes
}

export type WsMessage =
  | { type: "input"; id: string; data: string }
  | { type: "resize"; id: string; cols: number; rows: number }
  | { type: "output"; id: string; data: string }
  | { type: "state"; shells: ShellState[] }
  | { type: "stats"; stats: Record<string, ShellStats> }
  | { type: "get-scrollback"; id: string }
  | { type: "get-state" };
