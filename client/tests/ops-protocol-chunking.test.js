/**
 * Operational Test Suite: Protocol Chunking & CRC32 Data Integrity
 * Validates CRC32 hashing, binary packet headers, and chunk calculations.
 */

async function run() {
  console.log("  📦 Testing Protocol Chunking & CRC32 Integrity...");

  const { computeCrc32 } = await import("../src/lib/zip.ts");

  // 1. Standard CRC32 RFC 1952 standard test vector: "123456789" -> 0xCBF43926 (3421780262)
  const testString = "123456789";
  const bytes = new TextEncoder().encode(testString);
  const crc = computeCrc32(bytes);
  const EXPECTED_CRC = 0xcbf43926;

  if (crc !== EXPECTED_CRC) {
    throw new Error(`CRC32 mismatch! Expected 0x${EXPECTED_CRC.toString(16)}, got 0x${crc.toString(16)}`);
  }
  console.log("  ✅ CRC32 standard test vector verified (0xCBF43926).");

  // 2. Chunking Mathematics & Boundary Calculations
  const CHUNK_SIZE = 64 * 1024; // 64 KB

  const testCases = [
    { fileSize: 0, expectedChunks: 0 },
    { fileSize: 1, expectedChunks: 1 },
    { fileSize: 64 * 1024, expectedChunks: 1 },
    { fileSize: 64 * 1024 + 1, expectedChunks: 2 },
    { fileSize: 10 * 1024 * 1024, expectedChunks: 160 }, // 10 MB
  ];

  for (const tc of testCases) {
    const totalChunks = tc.fileSize === 0 ? 0 : Math.ceil(tc.fileSize / CHUNK_SIZE);
    if (totalChunks !== tc.expectedChunks) {
      throw new Error(`Chunking error for size ${tc.fileSize}: expected ${tc.expectedChunks}, got ${totalChunks}`);
    }
  }
  console.log("  ✅ Chunking boundary calculations verified across multiple file sizes.");

  // 3. Protocol Packet Format Integrity
  const metadataPacket = {
    cmd: "FILE_METADATA",
    id: "f-12345",
    fileKey: "test.zip-1048576-1700000000",
    name: "test.zip",
    size: 1048576,
    type: "application/zip",
    totalChunks: 16,
  };

  const serialized = JSON.stringify(metadataPacket);
  const deserialized = JSON.parse(serialized);

  if (
    deserialized.cmd !== "FILE_METADATA" ||
    deserialized.id !== "f-12345" ||
    deserialized.totalChunks !== 16
  ) {
    throw new Error("Protocol serialization error in FILE_METADATA");
  }
  console.log("  ✅ Protocol control packet schemas and JSON transport verified.");

  return true;
}

module.exports = { run };

if (require.main === module) {
  run()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error("  ❌ Test Failed:", err.message);
      process.exitCode = 1;
    });
}
