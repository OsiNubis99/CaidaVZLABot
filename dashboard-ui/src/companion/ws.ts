// socket.io transport for the Acompañante: the `/companion` namespace on the
// same server/path as the game, same Telegram initData auth.

import { io, Socket } from "socket.io-client";
import { initData } from "../lib/telegram";
import type { ConnState } from "../game/ws";
import { NAMESPACE, S2C } from "./protocol";
import type { CompanionErrorPayload, CompanionState, EndedReason } from "./types";

interface S2CMap {
  [S2C.STATE]: { state: CompanionState };
  [S2C.ERROR]: CompanionErrorPayload;
  [S2C.ENDED]: { reason: EndedReason };
}

type ConnHandler = (state: ConnState) => void;

export class CompanionSocket {
  private socket: Socket | null = null;
  private connHandlers = new Set<ConnHandler>();

  connect(): void {
    if (this.socket && this.socket.connected) return;
    if (this.socket) {
      this.socket.auth = { initData: initData() };
      this.socket.connect();
      this.emitConn("connecting");
      return;
    }
    this.emitConn("connecting");
    // Same prefix logic as the game socket (served under /caidavzlabot/).
    const dir = window.location.pathname.replace(/[^/]*$/, "");
    this.socket = io(NAMESPACE, {
      path: `${dir}socket.io/`,
      auth: { initData: initData() },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    this.socket.on("connect", () => this.emitConn("connected"));
    this.socket.on("disconnect", () => this.emitConn("disconnected"));
    this.socket.on("connect_error", () => this.emitConn("disconnected"));
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.emitConn("idle");
  }

  send(event: string, payload?: unknown, ack?: (res: unknown) => void): void {
    if (!this.socket) return;
    if (ack) this.socket.emit(event, payload ?? {}, ack);
    else this.socket.emit(event, payload ?? {});
  }

  on<K extends keyof S2CMap>(event: K, handler: (payload: S2CMap[K]) => void): () => void {
    if (!this.socket) return () => {};
    const sock = this.socket;
    sock.on(event as string, handler as (p: unknown) => void);
    return () => sock.off(event as string, handler as (p: unknown) => void);
  }

  onConn(handler: ConnHandler): () => void {
    this.connHandlers.add(handler);
    return () => this.connHandlers.delete(handler);
  }

  private emitConn(state: ConnState) {
    for (const h of this.connHandlers) h(state);
  }
}

export const companionSocket = new CompanionSocket();
