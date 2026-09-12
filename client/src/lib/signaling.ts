/**
 * Resilient WebSocket Signaling Client.
 * Connects directly to Standalone FastAPI backend or local WebSocket server.
 */

import { SignalingEnvelope, PeerRole } from "@/types/protocol";
import { getDeviceSummary } from "./id";

export type SignalingEventHandler = (envelope: SignalingEnvelope) => void;

export class SignalingClient {
  private socket: WebSocket | null = null;
  private roomId: string;
  private onMessageCallback: SignalingEventHandler;
  private assignedPeerId: string | null = null;
  private pingIntervalId: any = null;
  private isExplicitlyClosed = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;

  constructor(roomId: string, onMessage: SignalingEventHandler) {
    this.roomId = roomId.toUpperCase().trim();
    this.onMessageCallback = onMessage;
  }

  public get peerId(): string | null {
    return this.assignedPeerId;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isExplicitlyClosed = false;
      const wsUrl = this.resolveSignalingUrl(this.roomId);

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data: SignalingEnvelope = JSON.parse(event.data);
            if (data.type === "pong") return;
            if (data.type === "joined" && data.peerId) {
              this.assignedPeerId = data.peerId;
            }
            this.onMessageCallback(data);
          } catch (err) {
            console.error("[Signaling] Failed to parse message:", err);
          }
        };

        this.socket.onerror = (err) => {
          console.error("[Signaling] WebSocket error:", err);
        };

        this.socket.onclose = (event) => {
          this.stopHeartbeat();
          if (!this.isExplicitlyClosed) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
              console.log(`[Signaling] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              this.reconnectTimer = setTimeout(() => {
                this.connect().catch((err) => {
                  console.warn("[Signaling] Reconnect failed:", err);
                });
              }, delay);
            } else {
              this.onMessageCallback({
                type: "peer_left",
                message: "Signaling connection closed permanently.",
              });
            }
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public send(envelope: SignalingEnvelope): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (this.assignedPeerId && !envelope.from) {
        envelope.from = this.assignedPeerId;
      }
      this.socket.send(JSON.stringify(envelope));
    } else {
      console.warn("[Signaling] Socket not open, message dropped:", envelope.type);
    }
  }

  public configureRoom(maxPeers: number, requireApproval: boolean): void {
    this.send({
      type: "room_config",
      maxPeers,
      requireApproval,
    });
  }

  public approvePeer(targetPeerId: string): void {
    this.send({
      type: "approve_peer",
      targetPeerId,
      payload: { targetPeerId },
    });
  }

  public rejectPeer(targetPeerId: string): void {
    this.send({
      type: "reject_peer",
      targetPeerId,
      payload: { targetPeerId },
    });
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      this.send({ type: "ping", roomId: this.roomId });
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private resolveSignalingUrl(roomId: string): string {
    const deviceParam = `device=${encodeURIComponent(getDeviceSummary())}`;

    // Local dev detection only if running in browser on localhost or 127.0.0.1
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        const localBase = process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://127.0.0.1:8002/ws";
        return `${localBase.replace(/\/+$/, "")}/${roomId}?${deviceParam}`;
      }

      // Production: use same-origin WebSocket proxy at /ws/*
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/ws/${roomId}?${deviceParam}`;
    }

    return `wss://peerwarp.com/ws/${roomId}?${deviceParam}`;
  }
}
