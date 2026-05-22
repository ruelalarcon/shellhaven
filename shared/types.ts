export type RestartPolicy = "always" | "unless-stopped" | "never";

export type ServiceStatus = "running" | "stopped" | "crashed";

export interface ServiceState {
  id: string;
  status: ServiceStatus;
  restartPolicy: RestartPolicy;
  group?: string;
}

export type WsMessage =
  | { type: "input"; id: string; data: string }
  | { type: "resize"; id: string; cols: number; rows: number }
  | { type: "output"; id: string; data: string }
  | { type: "state"; services: ServiceState[] }
  | { type: "get-scrollback"; id: string }
  | { type: "get-state" };
