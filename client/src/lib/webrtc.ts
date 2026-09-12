/**
 * WebRTC RTCPeerConnection and DataChannel engine for PeerWarp.
 * Utilizes high-availability public STUN servers for zero-cost NAT traversal.
 */

import { SignalingClient } from "./signaling";
import { SignalingEnvelope, PeerRole } from "@/types/protocol";

// Default fallback STUN-only configuration (0 server storage & 0 proxy bandwidth)
const DEFAULT_STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.services.mozilla.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

let cachedDynamicConfig: { config: RTCConfiguration; expiresAt: number; roomId: string } | null = null;

export async function getDynamicRtcConfig(roomId?: string): Promise<RTCConfiguration> {
  const cleanRoom = (roomId || "DEFAULT").toUpperCase().trim();
  const now = Date.now();

  if (
    cachedDynamicConfig &&
    cachedDynamicConfig.roomId === cleanRoom &&
    now < cachedDynamicConfig.expiresAt
  ) {
    return cachedDynamicConfig.config;
  }

  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/v1/turn-credentials?room=${encodeURIComponent(cleanRoom)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && Array.isArray(data.iceServers)) {
          const dynamicConfig: RTCConfiguration = {
            iceServers: data.iceServers,
            iceCandidatePoolSize: 10,
          };
          cachedDynamicConfig = {
            config: dynamicConfig,
            expiresAt: now + (data.ttl ? (data.ttl - 300) * 1000 : 3000 * 1000),
            roomId: cleanRoom,
          };
          return dynamicConfig;
        }
      }
    } catch (err) {
      console.warn("[WebRTC] Could not fetch dynamic TURN token, falling back to direct STUN:", err);
    }
  }

  return DEFAULT_STUN_CONFIG;
}

export interface WebRTCEvents {
  onConnectionStateChange: (state: RTCPeerConnectionState, peerId?: string) => void;
  onDataChannelReady: (channel: RTCDataChannel, peerId?: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onError: (error: string, peerId?: string) => void;
}

interface PeerConnectionRecord {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  candidateQueue: RTCIceCandidateInit[];
  turnFallbackTimer?: ReturnType<typeof setTimeout> | null;
  hasUpgradedToTurn?: boolean;
}

export class WebRTCPeer {
  // Initiator manages multiple peer connections (Star topology)
  private peers: Map<string, PeerConnectionRecord> = new Map();
  // Receiver manages a single peer connection to the host
  private singlePc: RTCPeerConnection | null = null;
  private singleChannel: RTCDataChannel | null = null;
  private singleCandidateQueue: RTCIceCandidateInit[] = [];
  private singleTurnFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private singleHasUpgradedToTurn: boolean = false;

  private signaling: SignalingClient;
  private role: PeerRole;
  private events: WebRTCEvents;

  constructor(role: PeerRole, signaling: SignalingClient, events: WebRTCEvents) {
    this.role = role;
    this.signaling = signaling;
    this.events = events;
  }

  public async initialize(): Promise<void> {
    if (this.role === "receiver") {
      this.singleHasUpgradedToTurn = false;
      // Start connection with 100% free, anonymous public STUN (Zero TURN allocation)
      this.singlePc = new RTCPeerConnection(DEFAULT_STUN_CONFIG);
      this.singleCandidateQueue = [];

      this.singlePc.onconnectionstatechange = () => {
        if (this.singlePc) {
          const state = this.singlePc.connectionState;
          if (state === "connected") {
            if (this.singleTurnFallbackTimer) {
              clearTimeout(this.singleTurnFallbackTimer);
              this.singleTurnFallbackTimer = null;
            }
            console.log("[WebRTC Receiver] Connected directly via public STUN (P2P). Zero TURN usage.");
          } else if (state === "failed" || state === "disconnected") {
            if (!this.singleHasUpgradedToTurn) {
              this.requestTurnUpgradeFromHost();
            }
          }
          this.events.onConnectionStateChange(state);
        }
      };

      this.singlePc.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.send({
            type: "ice_candidate",
            to: "host",
            payload: event.candidate.toJSON(),
          });
        }
      };

      this.singlePc.ondatachannel = (event) => {
        console.log("[WebRTC Receiver] Received DataChannel from host!");
        this.singleChannel = event.channel;
        this.setupDataChannel(this.singleChannel);
      };
    }
  }

  /**
   * Initiator initiates a WebRTC connection with a newly approved recipient.
   * Starts with fast public STUN; lazily upgrades to TURN relay only if direct P2P fails.
   */
  public async connectToRecipient(peerId: string): Promise<void> {
    if (this.role !== "initiator") return;
    if (this.peers.has(peerId)) {
      const existing = this.peers.get(peerId);
      if (existing?.turnFallbackTimer) clearTimeout(existing.turnFallbackTimer);
      existing?.pc.close();
      this.peers.delete(peerId);
    }

    console.log(`[WebRTC Host] Establishing connection with recipient: ${peerId} (Fast STUN P2P)`);
    // Start connection with 100% free, anonymous public STUN (Zero TURN allocation)
    const pc = new RTCPeerConnection(DEFAULT_STUN_CONFIG);
    const candidateQueue: RTCIceCandidateInit[] = [];

    const record: PeerConnectionRecord = {
      pc,
      dataChannel: null,
      candidateQueue,
      hasUpgradedToTurn: false,
      turnFallbackTimer: null,
    };
    this.peers.set(peerId, record);

    // Lazy TURN fallback timer: if direct P2P does not connect within 4 seconds, upgrade to TURN relay
    record.turnFallbackTimer = setTimeout(() => {
      if (pc.connectionState !== "connected" && !record.hasUpgradedToTurn) {
        console.log(`[WebRTC Host] Direct P2P negotiation took >4s for ${peerId}, lazily activating TURN relay fallback...`);
        this.upgradeToTurn(peerId);
      }
    }, 4000);

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        if (record.turnFallbackTimer) {
          clearTimeout(record.turnFallbackTimer);
          record.turnFallbackTimer = null;
        }
        console.log(`[WebRTC Host] Direct P2P connected to ${peerId} via STUN. Zero TURN relay required.`);
      } else if (state === "failed" || state === "disconnected") {
        if (!record.hasUpgradedToTurn) {
          console.log(`[WebRTC Host] Direct P2P connection ${state} for ${peerId}, activating TURN relay fallback...`);
          this.upgradeToTurn(peerId);
        }
      }
      this.events.onConnectionStateChange(state, peerId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: "ice_candidate",
          to: peerId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Host creates dedicated DataChannel for this peer
    const dataChannel = pc.createDataChannel(`peerwarp_${peerId}`, { ordered: true });
    record.dataChannel = dataChannel;
    this.setupDataChannel(dataChannel, peerId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        to: peerId,
        payload: { sdp: offer.sdp, type: offer.type },
      });
      console.log(`[WebRTC Host] Sent SDP offer to recipient ${peerId}`);
    } catch (err: any) {
      console.error(`[WebRTC Host] Failed to create offer for ${peerId}:`, err);
      this.events.onError(err?.message || "Failed to create offer", peerId);
    }
  }

  public async handleSignalingMessage(envelope: SignalingEnvelope): Promise<void> {
    try {
      // 1. Receiver logic: handling messages from the host
      if (this.role === "receiver" && this.singlePc) {
        if (envelope.type === "turn_upgrade") {
          console.log("[WebRTC Receiver] Received TURN upgrade request from host. Fetching TURN credentials...");
          this.singleHasUpgradedToTurn = true;
          try {
            const dynamicConfig = await getDynamicRtcConfig(this.signaling.currentRoomId);
            if (this.singlePc && typeof this.singlePc.setConfiguration === "function") {
              this.singlePc.setConfiguration(dynamicConfig);
            }
          } catch (err) {
            console.warn("[WebRTC Receiver] Failed to set dynamic TURN config on receiver:", err);
          }
          return;
        }

        if (envelope.type === "offer") {
          console.log("[WebRTC Receiver] Handling SDP offer from host");
          await this.singlePc.setRemoteDescription(new RTCSessionDescription(envelope.payload));
          await this.flushQueue(this.singlePc, this.singleCandidateQueue);

          const answer = await this.singlePc.createAnswer();
          await this.singlePc.setLocalDescription(answer);

          this.signaling.send({
            type: "answer",
            to: envelope.from || "host",
            payload: { sdp: answer.sdp, type: answer.type },
          });
          console.log("[WebRTC Receiver] Sent SDP answer to host");
        } else if (envelope.type === "ice_candidate" && envelope.payload) {
          if (this.singlePc.remoteDescription && this.singlePc.remoteDescription.type) {
            await this.singlePc.addIceCandidate(new RTCIceCandidate(envelope.payload));
          } else {
            this.singleCandidateQueue.push(envelope.payload);
          }
        }
        return;
      }

      // 2. Initiator logic: handling messages from a specific recipient
      if (this.role === "initiator") {
        const fromPeerId = envelope.from || envelope.peerId;
        if (!fromPeerId) return;

        if (envelope.type === "turn_upgrade") {
          console.log(`[WebRTC Host] Received TURN upgrade request from recipient ${fromPeerId}`);
          await this.upgradeToTurn(fromPeerId);
          return;
        }

        if (envelope.type === "peer_approved") {
          await this.connectToRecipient(fromPeerId);
          return;
        }

        const peerRecord = this.peers.get(fromPeerId);
        if (!peerRecord) return;

        if (envelope.type === "answer") {
          console.log(`[WebRTC Host] Received SDP answer from ${fromPeerId}`);
          await peerRecord.pc.setRemoteDescription(new RTCSessionDescription(envelope.payload));
          await this.flushQueue(peerRecord.pc, peerRecord.candidateQueue);
        } else if (envelope.type === "ice_candidate" && envelope.payload) {
          if (peerRecord.pc.remoteDescription && peerRecord.pc.remoteDescription.type) {
            await peerRecord.pc.addIceCandidate(new RTCIceCandidate(envelope.payload));
          } else {
            peerRecord.candidateQueue.push(envelope.payload);
          }
        } else if (envelope.type === "peer_left") {
          this.disconnectPeer(fromPeerId);
        }
      }
    } catch (err: any) {
      console.error("[WebRTC] Error processing signaling message:", err);
      this.events.onError(err?.message || "Signaling negotiation failed");
    }
  }

  public disconnectPeer(peerId: string): void {
    const record = this.peers.get(peerId);
    if (record) {
      if (record.turnFallbackTimer) {
        clearTimeout(record.turnFallbackTimer);
        record.turnFallbackTimer = null;
      }
      if (record.dataChannel) {
        try { record.dataChannel.close(); } catch (_) {}
      }
      try { record.pc.close(); } catch (_) {}
      this.peers.delete(peerId);
      this.events.onPeerDisconnected?.(peerId);
    }
  }

  private async flushQueue(pc: RTCPeerConnection, queue: RTCIceCandidateInit[]): Promise<void> {
    while (queue.length > 0) {
      const cand = queue.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (_) {}
      }
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerId?: string): void {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      console.log(`[DataChannel] Ready for ${peerId || "single-peer"}`);
      this.events.onDataChannelReady(channel, peerId);
    };

    channel.onerror = (err) => {
      console.error(`[DataChannel] Error on ${peerId}:`, err);
      this.events.onError("DataChannel encountered an error", peerId);
    };

    channel.onclose = () => {
      console.log(`[DataChannel] Closed on ${peerId}`);
    };
  }

  public getActiveDataChannels(): RTCDataChannel[] {
    if (this.role === "receiver") {
      return this.singleChannel && this.singleChannel.readyState === "open"
        ? [this.singleChannel]
        : [];
    }
    const openChannels: RTCDataChannel[] = [];
    for (const record of this.peers.values()) {
      if (record.dataChannel && record.dataChannel.readyState === "open") {
        openChannels.push(record.dataChannel);
      }
    }
    return openChannels;
  }

  public getDataChannel(): RTCDataChannel | null {
    const channels = this.getActiveDataChannels();
    return channels.length > 0 ? channels[0] : null;
  }

  public async getActiveRoute(peerId?: string): Promise<{
    type: "wifi_direct" | "p2p_stun" | "relay" | "unknown";
    label: string;
    isLocal: boolean;
  }> {
    let pc: RTCPeerConnection | null = null;
    if (this.role === "receiver") {
      pc = this.singlePc;
    } else if (peerId) {
      pc = this.peers.get(peerId)?.pc || null;
    } else if (this.peers.size > 0) {
      pc = Array.from(this.peers.values())[0]?.pc || null;
    }

    if (!pc) {
      return { type: "unknown", label: "P2P Connection", isLocal: true };
    }

    try {
      const stats = await pc.getStats();
      let activePair: any = null;
      for (const entry of stats.values()) {
        if (entry.type === "transport" && entry.selectedCandidatePairId) {
          activePair = stats.get(entry.selectedCandidatePairId);
        }
        if (entry.type === "candidate-pair" && (entry.selected || entry.state === "succeeded")) {
          activePair = entry;
        }
      }

      if (activePair) {
        const localCand = stats.get(activePair.localCandidateId);
        const remoteCand = stats.get(activePair.remoteCandidateId);
        const localType = localCand?.candidateType;
        const remoteType = remoteCand?.candidateType;

        if (localType === "host" && remoteType === "host") {
          return {
            type: "wifi_direct",
            label: "Local Wi-Fi Direct (0 MB Internet Used • Router Speed)",
            isLocal: true,
          };
        }
        if (localType === "relay" || remoteType === "relay") {
          return {
            type: "relay",
            label: "Cloud Relay Tunnel (Encrypted)",
            isLocal: false,
          };
        }
        return {
          type: "p2p_stun",
          label: "Direct P2P Internet (Encrypted DTLS)",
          isLocal: false,
        };
      }
    } catch (_) {}

    return { type: "unknown", label: "Local Wi-Fi / P2P Direct", isLocal: true };
  }

  public async restartIce(peerId?: string): Promise<void> {
    if (this.role === "initiator") {
      const records = peerId ? [this.peers.get(peerId)].filter(Boolean) : Array.from(this.peers.values());
      for (const record of records) {
        if (!record) continue;
        try {
          if (typeof (record.pc as any).restartIce === "function") {
            (record.pc as any).restartIce();
          }
          const offer = await record.pc.createOffer({ iceRestart: true });
          await record.pc.setLocalDescription(offer);
          const targetId = Array.from(this.peers.entries()).find(([, r]) => r === record)?.[0];
          if (targetId) {
            this.signaling.send({
              type: "offer",
              to: targetId,
              payload: { sdp: offer.sdp, type: offer.type },
            });
            console.log(`[WebRTC Host] Sent ICE restart offer to ${targetId}`);
          }
        } catch (err) {
          console.warn("[WebRTC Host] ICE restart failed:", err);
        }
      }
    }
  }

  /**
   * Lazily upgrades a specific peer connection to use private TURN relay credentials
   * when direct P2P connection via STUN fails or times out.
   */
  private async upgradeToTurn(peerId: string): Promise<void> {
    const record = this.peers.get(peerId);
    if (!record || record.hasUpgradedToTurn || record.pc.connectionState === "connected") {
      return;
    }
    record.hasUpgradedToTurn = true;
    if (record.turnFallbackTimer) {
      clearTimeout(record.turnFallbackTimer);
      record.turnFallbackTimer = null;
    }

    try {
      console.log(`[WebRTC Host] Fetching dynamic TURN configuration for fallback on peer ${peerId}...`);
      const dynamicConfig = await getDynamicRtcConfig(this.signaling.currentRoomId);

      if (typeof record.pc.setConfiguration === "function") {
        record.pc.setConfiguration(dynamicConfig);
      }

      // Instruct the recipient to also fetch and configure TURN relay
      this.signaling.send({
        type: "turn_upgrade",
        to: peerId,
      });

      // Trigger WebRTC ICE restart with new TURN relay candidates
      if (typeof (record.pc as any).restartIce === "function") {
        (record.pc as any).restartIce();
      }
      const offer = await record.pc.createOffer({ iceRestart: true });
      await record.pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        to: peerId,
        payload: { sdp: offer.sdp, type: offer.type },
      });
      console.log(`[WebRTC Host] Sent TURN-upgraded ICE restart offer to ${peerId}`);
    } catch (err) {
      console.error(`[WebRTC Host] Failed to upgrade peer ${peerId} to TURN relay:`, err);
    }
  }

  /**
   * Receiver requests host to upgrade to TURN relay when direct P2P fails.
   */
  private requestTurnUpgradeFromHost(): void {
    if (this.singleHasUpgradedToTurn || (this.singlePc && this.singlePc.connectionState === "connected")) {
      return;
    }
    this.singleHasUpgradedToTurn = true;
    console.log("[WebRTC Receiver] Requesting host to initiate TURN upgrade...");
    this.signaling.send({
      type: "turn_upgrade",
      to: "host",
    });
  }

  public close(): void {
    if (this.singleTurnFallbackTimer) {
      clearTimeout(this.singleTurnFallbackTimer);
      this.singleTurnFallbackTimer = null;
    }
    if (this.singleChannel) {
      this.singleChannel.close();
      this.singleChannel = null;
    }
    if (this.singlePc) {
      this.singlePc.close();
      this.singlePc = null;
    }
    for (const record of this.peers.values()) {
      if (record.turnFallbackTimer) {
        clearTimeout(record.turnFallbackTimer);
        record.turnFallbackTimer = null;
      }
      if (record.dataChannel) record.dataChannel.close();
      record.pc.close();
    }
    this.peers.clear();
  }
}

