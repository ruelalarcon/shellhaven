# shellhaven

![GitHub Repo stars](https://img.shields.io/github/stars/ruelalarcon/shellhaven)
![GitHub License](https://img.shields.io/github/license/ruelalarcon/shellhaven)
![GitHub top language](https://img.shields.io/github/languages/top/ruelalarcon/shellhaven)

> An extremely simple-to-use, lightweight, self-hosted service manager built for personal servers.

Point it at a folder of bash scripts and get a browser-based UI with live terminals, automatic restarts, log rotation, and CPU/memory monitoring, all behind a password-protected login.

Unlike simple log viewers, shellhaven gives you full shell input through the browser. This makes it ideal for services that expect interactive commands, like a Minecraft server where you need to run `/op` or `/stop` without setting up RCON or a heavy control panel. It works equally well for monitoring and managing any kind of long-running service: web servers, bots, workers, scrapers, and more.

<img width="1840" height="978" alt="shellhaven-screenshot" src="https://github.com/user-attachments/assets/36ad8216-49e5-4ad6-8737-daf5bcec71dc" />

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [First Run](#first-run)
- [Creating Shells](#creating-shells)
  - [Basic Example](#basic-example)
  - [Script Directives](#script-directives)
  - [Restart Policy](#restart-policy)
  - [Groups](#groups)
  - [Log Folder Limit](#log-folder-limit)
  - [Rescan](#rescan)
- [Logging](#logging)
  - [Shell Process Logs](#shell-process-logs)
  - [Log Rotation](#log-rotation)
  - [Log Pruning](#log-pruning)
  - [Server Logs](#server-logs)
- [Default Behaviors](#default-behaviors)
- [btop Integration](#btop-integration)
- [Production Deployment](#production-deployment)
  - [Building](#building)
  - [systemd Service](#systemd-service)
  - [nginx Reverse Proxy](#nginx-reverse-proxy)
  - [HTTPS with Certbot](#https-with-certbot)
  - [Firewall / Port Access](#firewall--port-access)
- [Development](#development)

---

## Features

- **Live terminals** - full xterm.js terminal per shell, persisted in the browser across tab switches
- **Shell input** - type directly into any running service from the browser, no RCON or external tooling needed
- **Automatic restarts** - configurable per-shell restart policy with crash detection
- **Log rotation** - each shell gets its own log directory; logs are gzip-compressed on every spawn
- **Log browser** - view and download past logs directly from the UI
- **CPU & memory monitoring** - live per-shell resource usage sampled every 2 seconds
- **btop** - integrated system monitor, auto-launched if `btop` is installed
- **Groups** - organize shells into collapsible sidebar sections
- **Raw shell** - always-available interactive bash terminal for ad-hoc commands
- **Auth** - password-protected with a 7-day JWT session cookie

---

## Requirements

- **Node.js** 18 or later
- **npm** 9 or later
- A Linux/macOS host (node-pty requires a Unix PTY; WSL2 works on Windows)
- `btop` (optional) - install via your package manager for the integrated system monitor

---

## Installation

```bash
git clone https://github.com/ruelalarcon/shellhaven.git
cd shellhaven
npm install
npm run build
```

---

## First Run

```bash
npm start
```

Open [http://localhost:7456](http://localhost:7456) in your browser.

On first visit you will be taken to the **setup page** where you create a password (minimum 8 characters). This is stored as a bcrypt hash in `~/.config/shellhaven/config.json`. After setup, log in and you will see the dashboard.

For running shellhaven as a persistent background service that starts on boot, see [systemd Service](#systemd-service).

---

## Creating Shells

shellhaven scans `~/shells/` for `*.sh` files at startup and spawns each one as a managed PTY process. To add a new service, drop a bash script into that directory.

```
~/shells/
├── api.sh
├── worker.sh
└── scheduler.sh
```

The shell's **name** in the UI is derived from the filename (without `.sh`).

> **Adding shells while shellhaven is running:** Drop the new `.sh` file into `~/shells/` and click **rescan** in the sidebar. The shell will appear in the UI and start immediately, no restart required.

### Basic Example

```bash
# ~/shells/api.sh

cd /srv/myapp
exec node server.js
```

> Scripts do not need a shebang or the executable bit set — shellhaven spawns them as `bash <script>` directly.

> **Tip:** Use `exec` as the last command so the process replaces the bash wrapper. This makes CPU/memory stats accurate and ensures exit codes are passed through correctly.

### Script Directives

Behaviour is configured via specially formatted comments at the top of the script. All directives are optional. Directive values are read at initial startup and whenever you trigger a **rescan** (see below); they are not re-read on individual restarts.

```bash
# restart: always
# group: backend
# log-folder-limit: 50mb

exec node /srv/myapp/server.js
```

---

### Restart Policy

```
# restart: <policy>
```

Controls what shellhaven does when the process exits.

| Policy | Behavior |
|---|---|
| `unless-stopped` | Restart on crash or clean exit, **unless** you manually stopped it from the UI. **Default.** |
| `always` | Always restart, even after a manual stop. |
| `never` | Never restart automatically. |

A **crash** is defined as a non-zero exit code when the shell was not manually stopped. Crashed shells are shown with a distinct status badge. All automatic restarts have a fixed **3-second delay** before re-spawning.

**Default:** `unless-stopped`

---

### Groups

```
# group: <name>
```

Assign the shell to a named group in the sidebar. Shells in the same group are listed together under a collapsible section header. Shells without a group directive are listed ungrouped at the top.

```bash
# group: backend
# group: workers
# group: cron jobs
```

Group names are free-form text. Spaces are allowed.

**Default:** no group (ungrouped)

---

### Log Folder Limit

```
# log-folder-limit: <size>
```

Sets the maximum cumulative size of the shell's log folder (`~/shells/logs/<name>/`). Accepted units: `kb`, `mb`, `gb` (case-insensitive). After each log rotation, the oldest compressed log files are deleted until the folder is under the limit.

```bash
# log-folder-limit: 10mb
# log-folder-limit: 500kb
# log-folder-limit: 2gb
```

**Default:** `25mb`

---

### Rescan

The **rescan** button (in the sidebar next to *start all* and *stop all*) re-examines `~/shells/` live without restarting shellhaven. It does three things:

1. **New scripts** - any `.sh` file that wasn't present at startup is registered and spawned immediately
2. **Removed scripts** - any shell whose `.sh` file has been deleted is stopped (if running) and removed from the UI
3. **Changed directives** - `# restart:`, `# group:`, and `# log-folder-limit:` are re-parsed for every existing shell and take effect from the next spawn onward

Changed directives on a currently running shell take effect the next time it starts or restarts. A running shell is never interrupted by a rescan.

---

## Logging

### Shell Process Logs

Every shell gets its own log directory:

```
~/shells/logs/
└── api/
    ├── latest.log
    ├── 2026-05-20_10-00-00.log.gz
    └── 2026-05-21_08-30-45.log.gz
```

- **`latest.log`** - the active log for the current run, written in real time
- **`*.log.gz`** - gzip-compressed logs from previous runs, named by the time they were rotated

ANSI escape sequences (colors, cursor movement, etc.) are stripped before writing to disk so log files are plain text regardless of what the process outputs. The raw output (with ANSI) is still sent to the in-browser terminal and scrollback buffer.

Logs can be browsed and read directly from the UI via the **Logs** button in the sidebar controls for each shell.

### Log Rotation

Rotation happens automatically on every spawn (including restarts):

1. If `latest.log` exists and is non-empty, it is gzip-compressed to a timestamped `YYYY-MM-DD_HH-MM-SS.log.gz` file
2. The original `latest.log` is deleted
3. Old compressed files are pruned if the folder exceeds the limit (see [Log Pruning](#log-pruning))
4. A fresh `latest.log` is opened for the new run

Rotation is awaited before the process spawns, so there is no race between the old and new log files.

If `latest.log` is empty (e.g. the process exited immediately), it is deleted without creating a compressed archive.

### Log Pruning

After each rotation, shellhaven checks the total size of the log folder. If it exceeds the configured limit, it deletes the **oldest** compressed files one by one until the folder is within the limit.

Edge case: if a single run produces a log file that alone exceeds the limit, that compressed file is pruned immediately after creation. Only `latest.log` (the active run) is never pruned.

### Server Logs

shellhaven's own log output goes to **stdout/stderr** with timestamps, log levels, and scoped context labels:

```
2026-05-22 14:30:01.123 INFO  [shells] discovered 3 shell script(s): api, worker, scheduler
2026-05-22 14:30:01.201 INFO  [shells] [api] started (pid=12345)
2026-05-22 14:30:05.442 WARN  [shells] [worker] crashed (exit code 1)
2026-05-22 14:30:05.443 INFO  [shells] [worker] scheduling restart in 3000ms
2026-05-22 14:31:02.010 INFO  [ws] client connected from ::1 (1 total)
2026-05-22 14:32:15.887 WARN  [auth] failed login attempt from 203.0.113.42
```

ANSI colors are used when stdout is a TTY and stripped automatically when output is piped or redirected (e.g. captured by systemd journal).

**Log level** is controlled by the `LOG_LEVEL` environment variable:

| Level | What you see |
|---|---|
| `error` | Errors only |
| `warn` | Errors and warnings |
| `info` | Normal operational events. **Default.** |
| `debug` | Everything, including log rotation and pruning details |

```bash
LOG_LEVEL=debug npm start
```

---

## Default Behaviors

A summary of every default for quick reference:

| Setting | Default |
|---|---|
| Restart policy | `unless-stopped` |
| Restart delay | 3 seconds |
| Log folder limit | 25 MB per shell |
| Server port | `7456` |
| Server host | `localhost` |
| Session duration | 7 days |
| Scrollback buffer | 100 KB per terminal (in-memory only) |
| Log level | `info` |
| PTY size | 220 cols x 50 rows |
| btop | Enabled if `btop` is in `PATH` |

---

## btop Integration

If `btop` is installed and available in `PATH`, shellhaven automatically spawns it as a shared persistent PTY on startup. It appears as a special entry in the sidebar and is accessible to all connected clients simultaneously.

If btop exits for any reason (e.g. you press `q`), it restarts automatically after 1 second.

To install btop:

```bash
# Debian/Ubuntu
sudo apt install btop

# Arch
sudo pacman -S btop

# macOS
brew install btop
```

---

## Production Deployment

### Building

The `npm run build` step in [Installation](#installation) compiles both the client (Vite) and server (tsc) and is required before running `npm start`. To rebuild after making changes:

```bash
npm run build
npm start
```

The server port and host are configurable via environment variables:

```bash
PORT=7456 HOST=0.0.0.0 npm start
```

Set `HOST=0.0.0.0` only if you are **not** using a reverse proxy and need the port directly accessible. If you are using nginx (recommended), keep `HOST=localhost` and let nginx handle public traffic.

---

### systemd Service

Create a service file so shellhaven starts on boot and is managed like any other system service.

1. Copy and edit the service file:

```bash
sudo cp terminal-dashboard.service /etc/systemd/system/shellhaven.service
sudo nano /etc/systemd/system/shellhaven.service
```

2. Edit the file to match your paths and user — replace `you` with your Linux username throughout:

```ini
[Unit]
Description=shellhaven
After=network.target

[Service]
ExecStart=/usr/bin/node /home/you/shellhaven/server/dist/server/src/index.js
WorkingDirectory=/home/you/shellhaven
Restart=always
User=you
Environment=NODE_ENV=production
Environment=HOME=/home/you
Environment=PORT=7456
Environment=HOST=localhost

[Install]
WantedBy=multi-user.target
```

> Replace every occurrence of `you` with your actual Linux username (e.g. `alice`). Make sure `ExecStart` also points to the correct Node.js binary (`which node`) and the correct compiled output path.

3. Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable shellhaven
sudo systemctl start shellhaven
sudo systemctl status shellhaven
```

4. View logs:

```bash
journalctl -u shellhaven -f
```

---

### nginx Reverse Proxy

Using nginx is strongly recommended. It handles TLS termination, keeps shellhaven bound to `localhost`, and correctly proxies the WebSocket connection.

1. Install nginx:

```bash
sudo apt install nginx
```

2. Create a site config (replace `your.domain.com`):

```bash
sudo nano /etc/nginx/sites-available/shellhaven
```

```nginx
server {
    listen 80;
    server_name your.domain.com;

    location / {
        proxy_pass http://localhost:7456;
        proxy_http_version 1.1;

        # Required for WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

3. Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/shellhaven /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### HTTPS with Certbot

1. Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

2. Obtain and install a certificate (replaces the HTTP block with an HTTPS one automatically):

```bash
sudo certbot --nginx -d your.domain.com
```

3. Certbot will modify your nginx config to add TLS and set up automatic HTTP to HTTPS redirection. Your final config will look roughly like:

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;

    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:7456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name your.domain.com;
    return 301 https://$host$request_uri;
}
```

4. Certbot installs a cron job / systemd timer that auto-renews certificates before they expire. Verify it:

```bash
sudo certbot renew --dry-run
```

---

### Firewall / Port Access

shellhaven itself only listens on `localhost:7456` by default. If you are using nginx as a reverse proxy (recommended), you only need to open the standard web ports to the internet.

**Recommended setup (with nginx + TLS):**

```bash
sudo ufw allow OpenSSH       # keep SSH access
sudo ufw allow 80/tcp        # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable
```

Port `7456` does **not** need to be opened; nginx proxies to it internally.

**Direct access (no nginx, not recommended for production):**

If you want to expose shellhaven directly without a reverse proxy, bind it to all interfaces and open the port:

```bash
# In your systemd service or shell:
HOST=0.0.0.0 PORT=7456 npm start

# Open the port in your firewall:
sudo ufw allow 7456/tcp
```

Note that without TLS your session cookie and terminal I/O will be transmitted in plaintext. Only do this on a trusted private network.

**Cloud providers:** If you are on AWS, GCP, DigitalOcean, Hetzner, etc., you may also need to open ports in the provider's firewall or security group settings in addition to `ufw`. The ports to open are the same: `80` and `443` for a standard nginx + TLS setup.

---

## Development

```bash
# In two separate terminals:
npm run dev:server   # Express server on localhost:7456
npm run dev:client   # Vite dev server (proxies API to :7456)
```

To type-check the server:

```bash
cd server && npx tsc --noEmit
```

To type-check the client:

```bash
cd client && npm run check
```

The `LOG_LEVEL` environment variable controls server log verbosity. Set it to `debug` to see detailed output including log rotation and pruning:

```bash
LOG_LEVEL=debug npm run dev:server
```
