/**
 * File chunk streaming engine with backpressure flow control.
 * Prevents browser memory exhaustion when transferring multi-gigabyte files.
 */

import { computeSHA256 } from "./crypto";
import { FileMetadataPacket, FileCompletePacket } from "@/types/protocol";

export const CHUNK_SIZE = 64 * 1024; // 64 KB per packet
export const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1 MB buffer ceiling
export const BUFFER_LOW_THRESHOLD = 256 * 1024; // 256 KB threshold to resume

export interface StreamProgressUpdate {
  bytesTransferred: number;
  totalBytes: number;
  progressPercent: number;
  speedBps: number;
  etaSeconds: number;
}

export class FileStreamSender {
  private channel: RTCDataChannel;
  private isCancelled = false;

  constructor(channel: RTCDataChannel) {
    this.channel = channel;
    this.channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  public async sendFile(
    file: File,
    onProgress: (update: StreamProgressUpdate) => void
  ): Promise<string> {
    this.isCancelled = false;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 1. Send Metadata control packet
    const meta: FileMetadataPacket = {
      cmd: "FILE_METADATA",
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      totalChunks,
      chunkSize: CHUNK_SIZE,
    };
    this.channel.send(JSON.stringify(meta));

    // 2. Stream chunks sequentially with backpressure flow control
    let offset = 0;
    let chunkIndex = 0;
    const startTime = performance.now();
    let lastSpeedCheckTime = startTime;
    let lastSpeedCheckBytes = 0;
    let currentSpeedBps = 0;

    // Full buffer for hash computation (in chunks)
    const hasherBuffers: ArrayBuffer[] = [];

    while (offset < file.size) {
      if (this.isCancelled) {
        this.channel.send(
          JSON.stringify({ cmd: "TRANSFER_CANCEL", id: fileId, reason: "Cancelled by sender" })
        );
        throw new Error("Transfer cancelled by user.");
      }

      // Backpressure check: wait if buffer exceeds threshold
      if (this.channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await this.waitForBufferLow();
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const chunkBuffer = await slice.arrayBuffer();

      this.channel.send(chunkBuffer);
      hasherBuffers.push(chunkBuffer);

      offset += chunkBuffer.byteLength;
      chunkIndex++;

      // Compute speed and ETA every 250ms
      const now = performance.now();
      const elapsedSinceCheck = (now - lastSpeedCheckTime) / 1000;
      if (elapsedSinceCheck >= 0.25) {
        const bytesDelta = offset - lastSpeedCheckBytes;
        currentSpeedBps = bytesDelta / elapsedSinceCheck;
        lastSpeedCheckTime = now;
        lastSpeedCheckBytes = offset;
      }

      const remainingBytes = file.size - offset;
      const etaSeconds = currentSpeedBps > 0 ? remainingBytes / currentSpeedBps : 0;
      const progressPercent = Math.min(100, Math.round((offset / file.size) * 100));

      onProgress({
        bytesTransferred: offset,
        totalBytes: file.size,
        progressPercent,
        speedBps: currentSpeedBps,
        etaSeconds,
      });
    }

    // 3. Compute cryptographic SHA-256
    const totalRawBuffer = new Uint8Array(file.size);
    let hashOffset = 0;
    for (const b of hasherBuffers) {
      totalRawBuffer.set(new Uint8Array(b), hashOffset);
      hashOffset += b.byteLength;
    }
    const finalSha256 = await computeSHA256(totalRawBuffer.buffer);

    // 4. Send completion confirmation packet
    const completePacket: FileCompletePacket = {
      cmd: "FILE_COMPLETE",
      id: fileId,
      sha256: finalSha256,
    };
    this.channel.send(JSON.stringify(completePacket));

    return finalSha256;
  }

  private waitForBufferLow(): Promise<void> {
    return new Promise<void>((resolve) => {
      const handler = () => {
        this.channel.removeEventListener("bufferedamountlow", handler);
        resolve();
      };
      this.channel.addEventListener("bufferedamountlow", handler);
    });
  }
}

export class FileStreamReceiver {
  private activeMetadata: FileMetadataPacket | null = null;
  private receivedChunks: ArrayBuffer[] = [];
  private receivedBytes = 0;
  private startTime = 0;
  private lastSpeedCheckTime = 0;
  private lastSpeedCheckBytes = 0;
  private currentSpeedBps = 0;

  public handleMetadata(meta: FileMetadataPacket): void {
    this.activeMetadata = meta;
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.startTime = performance.now();
    this.lastSpeedCheckTime = this.startTime;
    this.lastSpeedCheckBytes = 0;
    this.currentSpeedBps = 0;
  }

  public handleChunk(
    chunk: ArrayBuffer,
    onProgress: (update: StreamProgressUpdate) => void
  ): void {
    if (!this.activeMetadata) return;

    this.receivedChunks.push(chunk);
    this.receivedBytes += chunk.byteLength;

    const now = performance.now();
    const elapsedSinceCheck = (now - this.lastSpeedCheckTime) / 1000;
    if (elapsedSinceCheck >= 0.25) {
      const bytesDelta = this.receivedBytes - this.lastSpeedCheckBytes;
      this.currentSpeedBps = bytesDelta / elapsedSinceCheck;
      this.lastSpeedCheckTime = now;
      this.lastSpeedCheckBytes = this.receivedBytes;
    }

    const total = this.activeMetadata.size;
    const remainingBytes = Math.max(0, total - this.receivedBytes);
    const etaSeconds = this.currentSpeedBps > 0 ? remainingBytes / this.currentSpeedBps : 0;
    const progressPercent = Math.min(100, Math.round((this.receivedBytes / total) * 100));

    onProgress({
      bytesTransferred: this.receivedBytes,
      totalBytes: total,
      progressPercent,
      speedBps: this.currentSpeedBps,
      etaSeconds,
    });
  }

  public async finalize(
    expectedSha256: string
  ): Promise<{ blob: Blob; verified: boolean; actualSha256: string }> {
    if (!this.activeMetadata) {
      throw new Error("No active transfer to finalize.");
    }

    const blob = new Blob(this.receivedChunks, { type: this.activeMetadata.type });
    const fullBuffer = await blob.arrayBuffer();
    const actualSha256 = await computeSHA256(fullBuffer);
    const verified = actualSha256.toLowerCase() === expectedSha256.toLowerCase();

    // Reset state
    this.activeMetadata = null;
    this.receivedChunks = [];
    this.receivedBytes = 0;

    return { blob, verified, actualSha256 };
  }
}
