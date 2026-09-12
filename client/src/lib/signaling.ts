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
  private pingIntervalId: any = null;
  private isExplicitlyClosed = false;
  private assignedPeerId: string | null = null;

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
            this.onMessageCallback({
              type: "peer_left",
              message: "Signaling connection closed.",
            });
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
      payload: { targetPeerId },
    });
  }

  public rejectPeer(targetPeerId: string): void {
    this.send({
      type: "reject_peer",
      payload: { targetPeerId },
    });
  }

  public close(): void {
    this.isExplicitlyClosed = true;
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

    // 1. Explicit env override
    if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
      const base = process.env.NEXT_PUBLIC_SIGNALING_URL.replace(/\/+$/, "");
      const separator = base.includes("?") ? "&" : "?";
      return `${base}/${roomId}${separator}${deviceParam}`;
    }

    // 2. Local dev detection (defaults to port 8002 for FastAPI)
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return `ws://127.0.0.1:8002/ws/${roomId}?${deviceParam}`;
      }
      // 3. Production: use edge Cloudflare Worker signaling
      return `wss://peerwarp-signaling.ahmedkhaled791.workers.dev/ws/${roomId}?${deviceParam}`;
    }

    return `wss://peerwarp-signaling.ahmedkhaled791.workers.dev/ws/${roomId}?${deviceParam}`;
  }
}
