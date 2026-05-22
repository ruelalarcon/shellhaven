import type { WsMessage } from "./types";

type MessageHandler = (msg: WsMessage) => void;
type StateHandler = () => void;

let socket: WebSocket | null = null;
const handlers = new Set<MessageHandler>();
const openHandlers = new Set<StateHandler>();
const closeHandlers = new Set<StateHandler>();

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}/ws`);

  socket.onopen = () => {
    for (const h of openHandlers) h();
  };

  socket.onmessage = (e) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(e.data as string) as WsMessage;
    } catch {
      return;
    }
    for (const h of handlers) h(msg);
  };

  socket.onclose = () => {
    for (const h of closeHandlers) h();
    setTimeout(connect, 2000);
  };

  socket.onerror = () => {
    socket?.close();
  };
}

connect();

export function send(msg: WsMessage) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

export function onMessage(handler: MessageHandler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function onOpen(handler: StateHandler) {
  openHandlers.add(handler);
  if (socket?.readyState === WebSocket.OPEN) handler();
  return () => openHandlers.delete(handler);
}

export function onClose(handler: StateHandler) {
  closeHandlers.add(handler);
  return () => closeHandlers.delete(handler);
}

export function isConnected() {
  return socket?.readyState === WebSocket.OPEN;
}
