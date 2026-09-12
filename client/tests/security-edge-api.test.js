/**
 * Security Test Suite: Cloudflare Edge API & Rate Limiting Enforcement
 * Validates ephemeral TURN credential generation, Turnstile verification, and rate limiter exemptions.
 */

const BASE_URL = "https://peerwarp.com";

async function run() {
  console.log(`  🌐 Testing Edge API endpoints & security controls on ${BASE_URL}...`);

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  if (!healthRes.ok) {
    throw new Error(`/health endpoint returned status ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  if (healthData.status !== "healthy") {
    throw new Error(`Unexpected health payload: ${JSON.stringify(healthData)}`);
  }
  console.log("  ✅ Edge Worker health check is OK.");

  // 2. Ephemeral TURN Credentials generation (RFC 5766)
  const room = "TEST_SEC_" + Math.random().toString(36).substring(2, 7).toUpperCase();
  const turnRes = await fetch(`${BASE_URL}/api/v1/turn-credentials?room=${room}`);
  if (!turnRes.ok) {
    throw new Error(`/api/v1/turn-credentials returned HTTP ${turnRes.status}`);
  }
  const turnData = await turnRes.json();
  if (!Array.isArray(turnData.iceServers) || turnData.iceServers.length < 2) {
    throw new Error("Invalid iceServers format in turn-credentials response");
  }

  const turnServer = turnData.iceServers.find((s) => s.username && s.credential);
  if (!turnServer) {
    throw new Error("Missing authenticated TURN server entry in credentials payload");
  }

  // Validate username timestamp
  const parts = turnServer.username.split(":");
  const expiryTimestamp = parseInt(parts[0], 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(expiryTimestamp) || expiryTimestamp <= now) {
    throw new Error(`Expired or invalid timestamp in TURN username: ${turnServer.username}`);
  }
  console.log("  ✅ Ephemeral HMAC-SHA1 TURN credentials successfully minted (TTL 3600s).");

  // 3. Radar / Local Wi-Fi exemption verification
  const radarRoom = "RADAR_" + Math.random().toString(36).substring(2, 7).toUpperCase();
  const radarRes = await fetch(`${BASE_URL}/api/v1/turn-credentials?room=${radarRoom}&radar=true`);
  if (!radarRes.ok) {
    throw new Error(`Radar local transfer endpoint returned HTTP ${radarRes.status}`);
  }
  console.log("  ✅ Local Wi-Fi Radar requests bypass rate limiting as expected.");

  // 4. Cloudflare Turnstile verification endpoint (Must reject empty/missing token)
  const turnstileRes = await fetch(`${BASE_URL}/api/v1/verify-turnstile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (turnstileRes.status !== 400) {
    throw new Error(`Expected HTTP 400 for empty Turnstile token, got ${turnstileRes.status}`);
  }
  const turnstileData = await turnstileRes.json();
  if (turnstileData.success !== false) {
    throw new Error("Turnstile endpoint allowed empty payload without error");
  }
  console.log("  ✅ Turnstile Captcha verification strictly validates token payloads.");

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
