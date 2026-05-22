export type { RestartPolicy, ServiceState, ServiceStatus, WsMessage, LogEntry } from "~shared/types";

export type PaneView =
  | { type: "terminal" }
  | { type: "logs" }
  | { type: "log-file"; filename: string };
