import express from "express";
import cookieParser from "cookie-parser";
import * as http from "http";
import * as path from "path";
import { WebSocketServer } from "ws";
import authRouter from "./routes/auth";
import apiRouter from "./routes/api";
import { requireAuth } from "./middleware/auth";
import { getConfig } from "./config";
import { initShells } from "./services/shellManager";
import { setupWebSocket } from "./ws/terminal";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(authRouter);

app.use("/api", requireAuth, apiRouter);

// In dev (tsx), __dirname is server/src. In prod (tsc), it's server/dist/server/src.
const clientDist = __dirname.includes("dist")
  ? path.resolve(__dirname, "../../../../client/dist")
  : path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientDist));

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

setupWebSocket(wss);
initShells();

const PORT = parseInt(process.env.PORT || "7456", 10);
const HOST = process.env.HOST || "localhost";

server.listen(PORT, HOST, () => {
  console.log(`shellhaven running at http://${HOST}:${PORT}`);
});
