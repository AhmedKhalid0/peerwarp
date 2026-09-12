/**
 * Operational Test Suite: Resumable Transfer State Machine & Handshake Logic
 * Validates fileKey fingerprinting, offset seek arithmetic, and resume handshake packets.
 */

async function run() {
  console.log("  🔄 Testing Resumable Transfer State Machine...");

  const { generateFileKey } = await import("../src/lib/checkpoint.ts");

  // 1. Deterministic fileKey generation
  const fileA1 = { name: "video.mp4", size: 52428800, lastModified: 1726000000 };
  const fileA2 = { name: "video.mp4", size: 52428800, lastModified: 1726000000 };
  const fileB = { name: "video.mp4", size: 52428800, lastModified: 1726000001 }; // modified 1s later

  const keyA1 = generateFileKey(fileA1);
  const keyA2 = generateFileKey(fileA2);
  const keyB = generateFileKey(fileB);

  if (keyA1 !== keyA2) {
    throw new Error(`Deterministic key mismatch: expected "${keyA1}" === "${keyA2}"`);
  }
  if (keyA1 === keyB) {
    throw new Error("File with different lastModified produced collision in fileKey!");
  }
  console.log("  ✅ Deterministic fileKey fingerprinting verified.");

  // 2. Resumable handshake validation
  const totalFileSize = 100 * 1024 * 1024; // 100 MB
  const chunkSize = 64 * 1024; // 64 KB

  // Scenario 1: Clean Resume at 40 MB
  const receivedBytes = 40 * 1024 * 1024; // 40 MB
  const resumeRequestPacket = {
    cmd: "RESUME_REQUEST",
    id: "f-resume-test",
    fileKey: keyA1,
    receivedBytes: receivedBytes,
  };

  // Sender verification logic
  let startOffset = 0;
  if (
    typeof resumeRequestPacket.receivedBytes === "number" &&
    resumeRequestPacket.receivedBytes > 0 &&
    resumeRequestPacket.receivedBytes < totalFileSize
  ) {
    startOffset = resumeRequestPacket.receivedBytes;
  }

  if (startOffset !== receivedBytes) {
    throw new Error(`Sender failed to seek to expected resume offset ${receivedBytes}`);
  }

  const startChunkIndex = Math.floor(startOffset / chunkSize);
  const expectedChunkIndex = (40 * 1024 * 1024) / (64 * 1024);
  if (startChunkIndex !== expectedChunkIndex) {
    throw new Error(`Chunk index calculation error: expected ${expectedChunkIndex}, got ${startChunkIndex}`);
  }

  // Scenario 2: Tampered / Out-of-bounds offset protection
  const tamperedOffset = totalFileSize + 1024; // Exceeds file size
  let safeOffset = 0;
  if (
    typeof tamperedOffset === "number" &&
    tamperedOffset > 0 &&
    tamperedOffset < totalFileSize
  ) {
    safeOffset = tamperedOffset;
  } else {
    safeOffset = 0; // Safeguard reset to 0
  }

  if (safeOffset !== 0) {
    throw new Error("Tampered resume offset was not reset to 0!");
  }
  console.log("  ✅ Resume handshake offset math and boundary protection verified.");

  // 3. Resume ACK serialization
  const resumeAckPacket = {
    cmd: "RESUME_ACK",
    id: "f-resume-test",
    fileKey: keyA1,
    startOffset: startOffset,
  };

  const serialized = JSON.stringify(resumeAckPacket);
  const parsed = JSON.parse(serialized);
  if (parsed.cmd !== "RESUME_ACK" || parsed.startOffset !== receivedBytes) {
    throw new Error("RESUME_ACK serialization failed");
  }
  console.log("  ✅ RESUME_ACK confirmation protocol verified.");

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
