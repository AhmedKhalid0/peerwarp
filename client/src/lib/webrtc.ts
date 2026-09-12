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
    { urls: "stun:turn.peerwarp.com:3478" },
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
}

export class WebRTCPeer {
  // Initiator manages multiple peer connections (Star topology)
  private peers: Map<string, PeerConnectionRecord> = new Map();
  // Receiver manages a single peer connection to the host
  private singlePc: RTCPeerConnection | null = null;
  private singleChannel: RTCDataChannel | null = null;
  private singleCandidateQueue: RTCIceCandidateInit[] = [];

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
      const config = await getDynamicRtcConfig(this.signaling.currentRoomId);
      this.singlePc = new RTCPeerConnection(config);
      this.singleCandidateQueue = [];

      this.singlePc.onconnectionstatechange = () => {
        if (this.singlePc) {
          this.events.onConnectionStateChange(this.singlePc.connectionState);
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
   */
  public async connectToRecipient(peerId: string): Promise<void> {
    if (this.role !== "initiator") return;
    if (this.peers.has(peerId)) {
      this.peers.get(peerId)?.pc.close();
      this.peers.delete(peerId);
    }

    console.log(`[WebRTC Host] Establishing connection with recipient: ${peerId}`);
    const config = await getDynamicRtcConfig(this.signaling.currentRoomId);
    const pc = new RTCPeerConnection(config);
    const candidateQueue: RTCIceCandidateInit[] = [];

    const record: PeerConnectionRecord = {
      pc,
      dataChannel: null,
      candidateQueue,
    };
    this.peers.set(peerId, record);

    pc.onconnectionstatechange = () => {
      this.events.onConnectionStateChange(pc.connectionState, peerId);
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

  public close(): void {
    if (this.singleChannel) {
      this.singleChannel.close();
      this.singleChannel = null;
    }
    if (this.singlePc) {
      this.singlePc.close();
      this.singlePc = null;
    }
    for (const record of this.peers.values()) {
      if (record.dataChannel) record.dataChannel.close();
      record.pc.close();
    }
    this.peers.clear();
  }
}

