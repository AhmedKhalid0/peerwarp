/**
 * WebRTC RTCPeerConnection and DataChannel engine for PeerWarp.
 * Utilizes high-availability public STUN servers for zero-cost NAT traversal.
 */

import { SignalingClient } from "./signaling";
import { SignalingEnvelope, PeerRole } from "@/types/protocol";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Tier 1: Zero-cost Direct P2P STUN Servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.services.mozilla.com:3478" },
    { urls: "stun:turn.peerwarp.com:3478" },

    // Tier 2: Dedicated Hetzner TURN Relay Node (UDP, TCP, and TLS)
    {
      urls: [
        "turn:turn.peerwarp.com:3478?transport=udp",
        "turn:turn.peerwarp.com:3478?transport=tcp",
        "turns:turn.peerwarp.com:5349?transport=tcp",
        "turns:turn.peerwarp.com:5349",
      ],
      username: "peerwarp",
      credential: "WarpSecure2026Turn!",
    },

    // Tier 3: Secondary Failover TURN Relay (OpenRelay)
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

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
      this.singlePc = new RTCPeerConnection(RTC_CONFIG);
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
    const pc = new RTCPeerConnection(RTC_CONFIG);
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

