export type RestartPolicy = "always" | "unless-stopped" | "never";

export type ServiceStatus = "running" | "stopped" | "crashed";

export interface ServiceState {
  id: string;
  status: ServiceStatus;
  restartPolicy: RestartPolicy;
  group?: string;
}

export interface LogEntry {
  name: string;
  size: number;
  mtime: number;
}

export interface ServiceStats {
  cpu: number;   // percent, 0-100
  mem: number;   // bytes
}

export type WsMessage =
  | { type: "input"; id: string; data: string }
  | { type: "resize"; id: string; cols: number; rows: number }
  | { type: "output"; id: string; data: string }
  | { type: "state"; services: ServiceState[] }
  | { type: "stats"; stats: Record<string, ServiceStats> }
  | { type: "get-scrollback"; id: string }
  | { type: "get-state" };
