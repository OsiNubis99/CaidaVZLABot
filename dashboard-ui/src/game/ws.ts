// T6 — typed socket.io transport for the realtime game.
//
// The WebApp is served from the bot process, so socket.io shares the same
// origin/port (loopback :3010 → nginx). We connect to the same origin and
// auth the handshake with the Telegram `initData` HMAC (mirrors the dashboard
// HTTP auth). Server validates it; an invalid initData rejects the connection.

import { io, Socket } from "socket.io-client";
import { initData } from "../lib/telegram";
import { S2C } from "./protocol";
import type {
  SessionStatePayload,
  SessionErrorPayload,
  SessionEndedPayload,
} from "./types";

export type ConnState = "idle" | "connecting" | "connected" | "disconnected";

/** S2C event → payload map, for typed `on()`. */
interface S2CMap {
  [S2C.SESSION_STATE]: SessionStatePayload;
  [S2C.SESSION_ERROR]: SessionErrorPayload;
  [S2C.SESSION_ENDED]: SessionEndedPayload;
}

type ConnHandler = (state: ConnState, detail?: string) => void;

export class GameSocket {
  private socket: Socket | null = null;
  private connHandlers = new Set<ConnHandler>();

  /** Open the connection. Idempotent: a live socket is reused. The socket.io
   *  path is left default (`/socket.io`); the server attaches there. */
  connect(): void {
    if (this.socket && this.socket.connected) return;
    if (this.socket) {
      // Refresh auth (initData can change between opens) and reconnect.
      this.socket.auth = { initData: initData() };
      this.socket.connect();
      this.emitConn("connecting");
      return;
    }

    this.emitConn("connecting");
    // Same-origin connection. socket.io infers the URL from the page when no
    // URL is passed, so the build works under any nginx path prefix.
    this.socket = io({
      auth: { initData: initData() },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("connect", () => this.emitConn("connected"));
    this.socket.on("disconnect", (reason: string) =>
      this.emitConn("disconnected", reason),
    );
    this.socket.on("connect_error", (err: Error) =>
      this.emitConn("disconnected", err?.message || "connect_error"),
    );
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.emitConn("idle");
  }

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  /** Emit a C2S action. Optional ack callback for events that reply (e.g.
   *  session:create may ack `{ code }` depending on the backend; we also
   *  derive the code from session:state, so the ack is best-effort). */
  send(event: string, payload?: unknown, ack?: (res: unknown) => void): void {
    if (!this.socket) {
      // Defer is overkill for SP1: surface the dropped action loudly instead.
      console.warn("[ws] send before connect:", event);
      return;
    }
    if (ack) this.socket.emit(event, payload ?? {}, ack);
    else this.socket.emit(event, payload ?? {});
  }

  /** Subscribe to a typed S2C event. Returns an unsubscribe fn. */
  on<K extends keyof S2CMap>(
    event: K,
    handler: (payload: S2CMap[K]) => void,
  ): () => void {
    if (!this.socket) {
      console.warn("[ws] on before connect:", event);
      return () => {};
    }
    const sock = this.socket;
    sock.on(event as string, handler as (p: unknown) => void);
    return () => sock.off(event as string, handler as (p: unknown) => void);
  }

  /** Subscribe to connection-state transitions. Returns an unsubscribe fn. */
  onConn(handler: ConnHandler): () => void {
    this.connHandlers.add(handler);
    return () => this.connHandlers.delete(handler);
  }

  private emitConn(state: ConnState, detail?: string) {
    for (const h of this.connHandlers) h(state, detail);
  }
}

// Single shared instance — the store owns its lifecycle.
export const gameSocket = new GameSocket();
