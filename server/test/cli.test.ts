import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { runCli } from "../src/cli";

test("CLI authenticates control requests and handles API results", async () => {
  const secret = "cli-test-secret";
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    const token = req.headers.cookie?.replace("sh_session=", "") ?? "";
    const claims = jwt.verify(token, secret) as jwt.JwtPayload;
    assert.equal(claims.exp! - claims.iat!, 30);
    seen.push(`${req.method} ${req.url}`);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/shells") {
      res.end(JSON.stringify([{ id: "api", status: "running", restartPolicy: "never" }]));
    } else if (req.url === "/api/shells/denied/restart") {
      res.writeHead(401).end('{}');
    } else if (req.url === "/api/shells/broken/restart") {
      res.writeHead(500).end('{}');
    } else {
      res.end(JSON.stringify({ ok: !req.url?.includes("missing") }));
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  const output: string[] = [];
  const options = {
    config: () => ({ jwtSecret: secret, passwordHash: "unused" }),
    env: { SHELLHAVEN_HOST: "0.0.0.0", SHELLHAVEN_PORT: String(port) },
    output: (message: string) => output.push(message),
  };
  try {
    await runCli(["list"], options);
    assert.match(output.pop()!, /api\trunning\tnever/);
    for (const command of ["start", "stop", "restart"]) {
      await runCli([command, "my service"], options);
      assert.equal(seen.at(-1), `POST /api/shells/my%20service/${command}`);
    }
    for (const command of ["start-all", "stop-all", "rescan"]) {
      await runCli([command], options);
      assert.equal(seen.at(-1), `POST /api/shells/${command}`);
    }
    await assert.rejects(runCli(["restart", "missing"], options), /shell not found/);
    await assert.rejects(runCli(["restart", "denied"], options), /Authentication failed/);
    await assert.rejects(runCli(["restart", "broken"], options), /HTTP 500/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  await assert.rejects(runCli(["list"], options), /Cannot reach Shellhaven/);
});

test("help and argument validation do not need configuration", async () => {
  const options = { config: () => { throw new Error("must not read config"); }, output: () => {} };
  await runCli(["--help"], options);
  for (const args of [["unknown"], ["restart"], ["list", "extra"], ["stop", "a", "b"], ["restart", ".."]]) {
    await assert.rejects(runCli(args, options), /Unknown command|Usage:|shell name/);
  }
  await assert.rejects(runCli(["list"], { config: () => null }), /Cannot read Shellhaven configuration/);
});
