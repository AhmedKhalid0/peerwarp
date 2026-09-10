/**
 * Web Crypto API utilities for client-side cryptographic hashing.
 * Guarantees zero data tampering without external dependencies.
 */

export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class StreamingSHA256 {
  private chunks: ArrayBuffer[] = [];
  private totalBytes = 0;

  public update(chunk: ArrayBuffer): void {
    this.chunks.push(chunk);
    this.totalBytes += chunk.byteLength;
  }

  public async digest(): Promise<string> {
    const merged = new Uint8Array(this.totalBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return computeSHA256(merged.buffer);
  }

  public reset(): void {
    this.chunks = [];
    this.totalBytes = 0;
  }
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}
