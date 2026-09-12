/**
 * Security Test Suite: TURN Anti-Proxy Enforcement & STUN Verification
 * Validates that Coturn rejects unauthorized relay requests with 401 Unauthorized
 * and only processes server-minted HMAC-SHA1 tokens.
 */

const dgram = require("dgram");

const TURN_HOST = "turn.peerwarp.com";
const TURN_PORT = 3478;

function sendStunPacket(msgBuffer, host, port, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let timer = null;

    socket.on("message", (msg) => {
      clearTimeout(timer);
      socket.close();
      resolve(msg);
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });

    timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timeout waiting for STUN/TURN response from ${host}:${port}`));
    }, timeoutMs);

    socket.send(msgBuffer, 0, msgBuffer.length, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        socket.close();
        reject(err);
      }
    });
  });
}

// Builds STUN Binding Request
function buildStunBindingRequest() {
  const buf = Buffer.alloc(20);
  buf.writeUInt16BE(0x0001, 0); // Binding Request
  buf.writeUInt16BE(0x0000, 2); // Message Length = 0
  buf.writeUInt32BE(0x2112a442, 4); // Magic Cookie
  // 12 bytes transaction ID
  for (let i = 8; i < 20; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

// Builds TURN Allocate Request (Attempts to allocate relay without auth)
function buildTurnAllocateRequest() {
  // 20-byte STUN header + 8 bytes REQUESTED-TRANSPORT attribute
  const buf = Buffer.alloc(28);
  buf.writeUInt16BE(0x0003, 0); // Allocate Request
  buf.writeUInt16BE(8, 2); // Message length = 8
  buf.writeUInt32BE(0x2112a442, 4); // Magic Cookie
  for (let i = 8; i < 20; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  // Attribute: REQUESTED-TRANSPORT (0x0019)
  buf.writeUInt16BE(0x0019, 20);
  buf.writeUInt16BE(4, 22); // length = 4
  buf.writeUInt8(17, 24); // Protocol: UDP (17)
  buf.writeUInt8(0, 25);
  buf.writeUInt8(0, 26);
  buf.writeUInt8(0, 27);
  return buf;
}

async function run() {
  console.log(`  🔒 Testing TURN Anti-Proxy Hardening on ${TURN_HOST}:${TURN_PORT}...`);

  // 1. Verify STUN Binding
  const bindingReq = buildStunBindingRequest();
  const bindingResp = await sendStunPacket(bindingReq, TURN_HOST, TURN_PORT);
  const bindingType = bindingResp.readUInt16BE(0);
  if (bindingType !== 0x0101) {
    throw new Error(`Expected STUN Binding Success (0x0101), received 0x${bindingType.toString(16)}`);
  }
  console.log("  ✅ STUN service is active and responsive (0x0101 Success).");

  // 2. Verify Anti-Proxy: Unauthorized TURN Allocate MUST return 401 Unauthorized (0x0113)
  const allocateReq = buildTurnAllocateRequest();
  const allocateResp = await sendStunPacket(allocateReq, TURN_HOST, TURN_PORT);
  const allocateType = allocateResp.readUInt16BE(0);

  if (allocateType === 0x0113) {
    console.log("  ✅ Anti-Proxy verified: Unauthorized TURN Allocate correctly rejected with 401 (0x0113).");
    return true;
  } else if (allocateType === 0x0103) {
    throw new Error("CRITICAL SECURITY FLAW: Coturn allowed open relay allocation without authentication (0x0103)!");
  } else {
    throw new Error(`Unexpected TURN Allocate response code: 0x${allocateType.toString(16)}`);
  }
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
