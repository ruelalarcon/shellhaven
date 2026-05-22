export type { RestartPolicy, ShellState, ShellStatus, WsMessage, LogEntry, ShellStats } from "~shared/types";

export type PaneView =
  | { type: "terminal" }
  | { type: "logs" }
  | { type: "log-file"; filename: string };
