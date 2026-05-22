import express from "express";
import cookieParser from "cookie-parser";
import * as http from "http";
import * as path from "path";
import { WebSocketServer } from "ws";
import authRouter from "./routes/auth";
import apiRouter from "./routes/api";
import { requireAuth } from "./middleware/auth";
import { getConfig } from "./config";
import { initServices } from "./services/serviceManager";
import { setupWebSocket } from "./ws/terminal";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(authRouter);

app.use("/api", requireAuth, apiRouter);

app.use(requireAuth, express.static(path.join(__dirname, "../../client/dist")));

app.get("*", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

setupWebSocket(wss);
initServices();

const PORT = parseInt(process.env.PORT || "7456", 10);
const HOST = process.env.HOST || "127.0.0.1";

server.listen(PORT, HOST, () => {
  console.log(`Terminal Dashboard running at http://${HOST}:${PORT}`);
  if (!getConfig()) {
    console.log("No config found — visit /setup to create a password.");
  }
});
