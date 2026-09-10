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
  | "error";

export interface SignalingEnvelope {
  type: SignalingMessageType;
  roomId?: string;
  role?: PeerRole;
  payload?: any;
  message?: string;
  peerCount?: number;
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
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
  expectedSha256?: string;
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
  size: number;
  type: string;
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: TransferState;
  sha256?: string;
  blobUrl?: string;
  error?: string;
}
