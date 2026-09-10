/**
 * WebRTC RTCPeerConnection and DataChannel engine for PeerWarp.
 * Utilizes high-availability public STUN servers for zero-cost NAT traversal.
 */

import { SignalingClient } from "./signaling";
import { SignalingEnvelope, PeerRole } from "@/types/protocol";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

export interface WebRTCEvents {
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDataChannelReady: (channel: RTCDataChannel) => void;
  onError: (error: string) => void;
}

export class WebRTCPeer {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signaling: SignalingClient;
  private role: PeerRole;
  private events: WebRTCEvents;

  constructor(role: PeerRole, signaling: SignalingClient, events: WebRTCEvents) {
    this.role = role;
    this.signaling = signaling;
    this.events = events;
  }

  public async initialize(): Promise<void> {
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.events.onConnectionStateChange(this.pc.connectionState);
      }
    };

    // Forward local ICE candidates to remote peer via signaling
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: "ice_candidate",
          payload: event.candidate.toJSON(),
        });
      }
    };

    if (this.role === "initiator") {
      // Initiator creates the DataChannel
      this.dataChannel = this.pc.createDataChannel("peerwarp_transfer", {
        ordered: true,
      });
      this.setupDataChannel(this.dataChannel);

      // Create and send SDP Offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        payload: { sdp: offer.sdp, type: offer.type },
      });
    } else {
      // Receiver waits for the incoming DataChannel
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }
  }

  public async handleSignalingMessage(envelope: SignalingEnvelope): Promise<void> {
    if (!this.pc) return;

    try {
      if (envelope.type === "offer" && this.role === "receiver") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(envelope.payload));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        this.signaling.send({
          type: "answer",
          payload: { sdp: answer.sdp, type: answer.type },
        });
      } else if (envelope.type === "answer" && this.role === "initiator") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(envelope.payload));
      } else if (envelope.type === "ice_candidate" && envelope.payload) {
        await this.pc.addIceCandidate(new RTCIceCandidate(envelope.payload));
      }
    } catch (err: any) {
      console.error("[WebRTC] Error processing signaling message:", err);
      this.events.onError(err?.message || "WebRTC signaling negotiation failed");
    }
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      this.events.onDataChannelReady(channel);
    };

    channel.onerror = (err) => {
      console.error("[DataChannel] Error:", err);
      this.events.onError("DataChannel encountered an error");
    };

    channel.onclose = () => {
      console.log("[DataChannel] Closed");
    };
  }

  public getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}
