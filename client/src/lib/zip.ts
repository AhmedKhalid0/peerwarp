/**
 * PeerWarp Zero-Dependency Client-Side ZIP Generator
 * Conforms to PKWARE PKZIP 2.0 specification.
 * Creates clean, universally compatible .zip archives directly in memory
 * with zero external dependencies.
 */

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
  name: string;
  data: Uint8Array;
  lastModified?: number;
}

/**
 * Packs multiple files/folders into a standard .zip Blob.
 */
export async function createZipArchive(files: ZipFileEntry[]): Promise<Blob> {
  const fileParts: Uint8Array[] = [];
  const centralDirParts: Uint8Array[] = [];

  let currentOffset = 0;
  const textEncoder = new TextEncoder();

  for (const file of files) {
    // Sanitize path against Zip Slip directory traversal (must use '/' and no '../' or leading '/')
    const sanitizedName = file.name
      .replace(/\\/g, "/")
      .replace(/\.\.+[/\\]/g, "")
      .replace(/^\/+/, "");
    const encodedName = textEncoder.encode(sanitizedName);
    const data = file.data;
    const size = data.length;
    const crc = computeCrc32(data);

    // DOS Date & Time format
    const d = file.lastModified ? new Date(file.lastModified) : new Date();
    const dosTime =
      ((d.getHours() & 0x1f) << 11) |
      ((d.getMinutes() & 0x3f) << 5) |
      ((Math.floor(d.getSeconds() / 2)) & 0x1f);
    const dosDate =
      (((d.getFullYear() - 1980) & 0x7f) << 9) |
      (((d.getMonth() + 1) & 0x0f) << 5) |
      (d.getDate() & 0x1f);

    // 1. Local File Header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + encodedName.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // General purpose bit flag (Bit 11: UTF-8)
    lv.setUint16(8, 0, true); // Compression method: 0 = Stored (Uncompressed)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true); // CRC-32
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, encodedName.length, true); // File name length
    lv.setUint16(28, 0, true); // Extra field length

    localHeader.set(encodedName, 30);
    fileParts.push(localHeader, data);

    // 2. Central Directory Header (46 bytes + name length)
    const cdHeader = new Uint8Array(46 + encodedName.length);
    const cv = new DataView(cdHeader.buffer);

    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 0x003f, true); // Version made by (UNIX / DOS)
    cv.setUint16(6, 20, true); // Version needed to extract
    cv.setUint16(8, 0x0800, true); // Bit flag (UTF-8)
    cv.setUint16(10, 0, true); // Compression method: Stored
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, encodedName.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0x81a40000, true); // External file attributes (regular file -rw-r--r--)
    cv.setUint32(42, currentOffset, true); // Relative offset of local header

    cdHeader.set(encodedName, 46);
    centralDirParts.push(cdHeader);

    currentOffset += localHeader.length + size;
  }

  // Calculate Central Directory size
  let centralDirSize = 0;
  for (const part of centralDirParts) {
    centralDirSize += part.length;
  }
  const centralDirOffset = currentOffset;

  // 3. End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);

  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, files.length, true); // Number of central directory records on this disk
  ev.setUint16(10, files.length, true); // Total number of central directory records
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, centralDirOffset, true); // Offset of start of central directory
  const allParts: any[] = [...fileParts, ...centralDirParts, eocd];
  return new Blob(allParts, {
    type: "application/zip",
  });
}

/**
 * Triggers standard browser download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
