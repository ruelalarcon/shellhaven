import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".config", "terminal-dashboard");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface Config {
  passwordHash: string;
  jwtSecret: string;
}

let cached: Config | null | undefined = undefined;

export function getConfig(): Config | null {
  if (cached !== undefined) return cached;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    cached = JSON.parse(raw) as Config;
  } catch {
    cached = null;
  }
  return cached;
}

export function saveConfig(config: Config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  cached = config;
}
