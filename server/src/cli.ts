#!/usr/bin/env node
import jwt from "jsonwebtoken";
import { getConfig } from "./config";
import type { ShellState } from "~shared/types";

const HELP = `Usage: shellhaven <command>

  list                 List shells and their status
  start <name>         Start a shell
  stop <name>          Stop a shell
  restart <name>       Restart a shell
  start-all            Start all shells
  stop-all             Stop all shells
  rescan               Discover scripts and reload directives
  help                 Show this help

Run as the same OS user as the server. No password or login is needed.
Uses ~/.config/shellhaven/config.json and SHELLHAVEN_HOST/SHELLHAVEN_PORT.
Shell names are script filenames without .sh.`;

interface CliOptions {
  config?: typeof getConfig;
  env?: NodeJS.ProcessEnv;
  output?: (message: string) => void;
}

export async function runCli(args: string[], options: CliOptions = {}): Promise<void> {
  const output = options.output ?? console.log;
  const [command, name, ...extra] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    output(HELP);
    return;
  }

  const individual = ["start", "stop", "restart"].includes(command);
  const global = ["list", "start-all", "stop-all", "rescan"].includes(command);
  if (!individual && !global) throw new Error(`Unknown command: ${command}. Run shellhaven help.`);
  if (extra.length || (individual ? !name : !!name)) {
    throw new Error(`Usage: shellhaven ${command}${individual ? " <name>" : ""}`);
  }
  // Dot segments are normalized by URL parsers, even when percent-encoded.
  if (individual && (name === "." || name === ".." || /[/\\]/.test(name))) {
    throw new Error("Use a shell name, not a script path.");
  }

  const config = (options.config ?? getConfig)();
  if (!config?.jwtSecret) {
    throw new Error("Cannot read Shellhaven configuration. Run as the server's OS user and complete initial web setup first.");
  }
  const env = options.env ?? process.env;
  let host = env.SHELLHAVEN_HOST || "localhost";
  if (host === "0.0.0.0") host = "127.0.0.1";
  if (host === "::") host = "::1";
  const port = env.SHELLHAVEN_PORT || "7456";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("SHELLHAVEN_PORT must be between 1 and 65535.");
  }
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(host)) throw new Error("Invalid SHELLHAVEN_HOST.");
  const authority = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const base = `http://${authority}:${port}`;
  const endpoint = individual
    ? `/api/shells/${encodeURIComponent(name)}/${command}`
    : command === "list" ? "/api/shells" : `/api/shells/${command}`;

  // Reading the local secret already grants server-owner access. Mint a fresh,
  // short-lived session for this request without storing or printing a token.
  const token = jwt.sign({}, config.jwtSecret, { expiresIn: "30s" });
  let response: Response;
  try {
    response = await fetch(base + endpoint, {
      method: command === "list" ? "GET" : "POST",
      headers: { Cookie: `sh_session=${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`Cannot reach Shellhaven at ${base}. Check that the server is running and host/port match.`);
  }
  if (response.status === 401) {
    throw new Error("Authentication failed. Run as the server's OS user and check that host/port point to that server.");
  }
  if (!response.ok) throw new Error(`Shellhaven returned HTTP ${response.status}.`);
  const result = await response.json();
  if (command === "list") {
    const shells = result as ShellState[];
    output(shells.length
      ? ["NAME\tSTATUS\tRESTART\tGROUP", ...shells.map(shell =>
        `${shell.id}\t${shell.status}\t${shell.restartPolicy}\t${shell.group ?? "-"}`)].join("\n")
      : "No shells found. Add scripts to ~/shells/ and run shellhaven rescan.");
  } else {
    if (result.ok !== true) throw new Error(`Could not ${command} ${name ?? "shells"}: shell not found or action unavailable in its current state.`);
    output(`Accepted: ${command}${name ? ` ${name}` : ""}.`);
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(`shellhaven: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
