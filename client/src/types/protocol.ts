/**
 * Protocol definition and type contracts for PeerWarp P2P streaming.
 */

export type PeerRole = "initiator" | "receiver";

export type SignalingMessageType =
  | "join"
  | "joined"
  | "offer"
  | "answer"
  | "ice_candidate"
  | "leave"
  | "peer_left"
  | "ping"
  | "pong"
  | "error"
  | "knock"
  | "approve_peer"
  | "reject_peer"
  | "peer_approved"
  | "peer_rejected"
  | "room_config"
  | "radar_join"
  | "radar_peers"
  | "radar_invite"
  | "radar_accept"
  | "radar_reject";

export interface SignalingEnvelope {
  type: SignalingMessageType;
  roomId?: string;
  role?: PeerRole;
  peerId?: string;
  from?: string;
  to?: string;
  payload?: any;
  message?: string;
  peerCount?: number;
  maxPeers?: number;
  deviceInfo?: string;
  requireApproval?: boolean;
  approved?: boolean;
  radarPeers?: RadarPeer[];
}

export interface RadarPeer {
  peerId: string;
  deviceInfo: string;
  joinedAt: number;
}

export interface RecipientPeer {
  peerId: string;
  deviceInfo: string;
  joinedAt: number;
  approved: boolean;
  status: "pending_approval" | "connecting" | "connected" | "transferring" | "completed" | "error";
  progress: number;
  speedBps: number;
}


export type DataChannelControlCommand =
  | "FILE_METADATA"
  | "CHUNK_ACK"
  | "FILE_COMPLETE"
  | "TRANSFER_CANCEL";

export interface FileMetadataPacket {
  cmd: "FILE_METADATA";
  id: string;
  name: string;
  relativePath?: string;
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
  expectedSha256?: string;
  compressed?: boolean;
}

export interface FileCompletePacket {
  cmd: "FILE_COMPLETE";
  id: string;
  sha256: string;
}

export interface TransferCancelPacket {
  cmd: "TRANSFER_CANCEL";
  id: string;
  reason?: string;
}

export type ControlPacket =
  | FileMetadataPacket
  | FileCompletePacket
  | TransferCancelPacket;

export type TransferState =
  | "idle"
  | "connecting"
  | "ready"
  | "sending"
  | "receiving"
  | "verifying"
  | "completed"
  | "cancelled"
  | "error";

export interface FileTransferItem {
  id: string;
  file?: File;
  name: string;
  relativePath?: string;
  size: number;
  type: string;
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: TransferState;
  sha256?: string;
  blobUrl?: string;
  blobData?: Uint8Array;
  isDirectSaved?: boolean;
  error?: string;
}

