/**
 * Minimal leveled logger with timestamps and ANSI color.
 * No external dependencies — writes directly to stdout/stderr.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const COLOR: Record<LogLevel, string> = {
  debug: "\x1b[90m",  // grey
  info:  "\x1b[36m",  // cyan
  warn:  "\x1b[33m",  // yellow
  error: "\x1b[31m",  // red
};
const RESET = "\x1b[0m";
const DIM   = "\x1b[2m";
const BOLD  = "\x1b[1m";

function isTTY() {
  return process.stdout.isTTY;
}

function formatLevel(level: LogLevel): string {
  const tag = level.toUpperCase().padEnd(5);
  return isTTY() ? `${BOLD}${COLOR[level]}${tag}${RESET}` : tag;
}

function formatTimestamp(): string {
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").slice(0, 23);
  return isTTY() ? `${DIM}${ts}${RESET}` : ts;
}

function formatContext(ctx?: string): string {
  if (!ctx) return " ";
  return isTTY() ? ` ${DIM}[${ctx}]${RESET} ` : ` [${ctx}] `;
}

let minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

export function setLogLevel(level: LogLevel) {
  minLevel = level;
}

function write(level: LogLevel, ctx: string | undefined, msg: string, ...args: unknown[]) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = `${formatTimestamp()} ${formatLevel(level)}${formatContext(ctx)}${msg}`;
  const extra = args.length ? " " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") : "";
  const out = line + extra;
  if (level === "error" || level === "warn") {
    process.stderr.write(out + "\n");
  } else {
    process.stdout.write(out + "\n");
  }
}

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

/** Create a logger scoped to a context label (shown in brackets). */
export function createLogger(context?: string): Logger {
  return {
    debug: (msg, ...args) => write("debug", context, msg, ...args),
    info:  (msg, ...args) => write("info",  context, msg, ...args),
    warn:  (msg, ...args) => write("warn",  context, msg, ...args),
    error: (msg, ...args) => write("error", context, msg, ...args),
  };
}

/** Root logger (no context label). */
export const log = createLogger();

/**
 * Strip ANSI/VT escape sequences from a string.
 * Pattern covers SGR colors, cursor movement, erase, extended VT100,
 * and archaic/proprietary printer codes.
 */
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "");
}
