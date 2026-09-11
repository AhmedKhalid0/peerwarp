/**
 * Resilient WebSocket Signaling Client.
 * Connects directly to Standalone FastAPI backend or local WebSocket server.
 */

import { SignalingEnvelope, PeerRole } from "@/types/protocol";

export type SignalingEventHandler = (envelope: SignalingEnvelope) => void;

export class SignalingClient {
  private socket: WebSocket | null = null;
  private roomId: string;
  private onMessageCallback: SignalingEventHandler;
  private pingIntervalId: any = null;
  private isExplicitlyClosed = false;

  constructor(roomId: string, onMessage: SignalingEventHandler) {
    this.roomId = roomId.toUpperCase().trim();
    this.onMessageCallback = onMessage;
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
      this.socket.send(JSON.stringify(envelope));
    } else {
      console.warn("[Signaling] Socket not open, message dropped:", envelope.type);
    }
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
    // 1. Explicit env override (only if not a localhost fallback in production)
    if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
      const base = process.env.NEXT_PUBLIC_SIGNALING_URL.replace(/\/+$/, "");
      if (typeof window !== "undefined") {
        const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if (isLocalHost) {
          return `${base}/${roomId}`;
        }
        if (!base.includes("127.0.0.1") && !base.includes("localhost")) {
          return `${base}/${roomId}`;
        }
      } else {
        return `${base}/${roomId}`;
      }
    }

    // 2. Local dev detection (defaults to port 8002 for FastAPI)
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return `ws://127.0.0.1:8002/ws/${roomId}`;
      }
      // 3. Production: use edge Cloudflare Worker signaling
      return `wss://peerwarp-signaling.ahmedkhaled791.workers.dev/ws/${roomId}`;
    }

    return `wss://peerwarp-signaling.ahmedkhaled791.workers.dev/ws/${roomId}`;
  }
}
