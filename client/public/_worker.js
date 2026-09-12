/**
 * PeerWarp Cloudflare Pages Edge Worker
 * Provides:
 * - Canonical 301 redirects
 * - WebSocket signaling forwarder to Durable Objects
 * - Ephemeral HMAC-SHA1 TURN credential minting (Anti-Proxy Protection - RFC 5766)
 * - Smart IP Rate Limiter (Max 10 TURN requests/hr, Max 15 rooms/hr, Local Wi-Fi EXEMPT)
 * - Cloudflare Turnstile Captcha verification endpoint
 * - SPA Dynamic routing
 */

const TURN_RELAY_DOMAIN = "turn.peerwarp.com";

// In-Memory Edge Rate Limiters
const ipTurnTracker = new Map(); // IP -> { count, resetAt }
const ipRoomTracker = new Map(); // IP -> { count, resetAt }

function isRateLimited(tracker, ip, maxLimit, windowMs) {
  const now = Date.now();
  const record = tracker.get(ip);
  if (!record || now >= record.resetAt) {
    tracker.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (record.count >= maxLimit) {
    return true;
  }
  record.count++;
  return false;
}

async function generateTurnCredentials(roomId, secretKey) {
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity
  const username = `${expiry}:${roomId}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey || "peerwarp_sec_fallback_secret_key"),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(username));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const credential = btoa(binary);

  return {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun.cloudflare.com:3478",
          `stun:${TURN_RELAY_DOMAIN}:3478`
        ]
      },
      {
        urls: [
          `turn:${TURN_RELAY_DOMAIN}:3478?transport=udp`,
          `turn:${TURN_RELAY_DOMAIN}:3478?transport=tcp`,
          `turns:${TURN_RELAY_DOMAIN}:5349?transport=tcp`,
          `turns:${TURN_RELAY_DOMAIN}:5349`
        ],
        username,
        credential
      }
    ],
    ttl: 3600
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

    // 1. Canonical 301 Permanent Redirect (SEO & Domain Integrity)
    if (
      (url.hostname.endsWith(".pages.dev") || url.hostname === "www.peerwarp.com") &&
      !url.pathname.startsWith("/ws") &&
      !url.pathname.startsWith("/api")
    ) {
      const canonicalUrl = new URL(request.url);
      canonicalUrl.hostname = "peerwarp.com";
      canonicalUrl.protocol = "https:";
      canonicalUrl.port = "";
      return Response.redirect(canonicalUrl.toString(), 301);
    }

    // 2. Ephemeral TURN Credentials API (RFC 5766 Time-Limited Tokens)
    if (url.pathname === "/api/v1/turn-credentials") {
      const room = (url.searchParams.get("room") || "DEFAULT").toUpperCase().trim();
      const isRadar = room.startsWith("RADAR") || url.searchParams.get("radar") === "true";

      // Rate limit per IP: Max 10 TURN token requests per hour (exempt for radar / local)
      if (!isRadar && isRateLimited(ipTurnTracker, clientIp, 10, 60 * 60 * 1000)) {
        return new Response(
          JSON.stringify({
            error: "RATE_LIMIT_EXCEEDED",
            message: "TURN relay rate limit reached (10 sessions / hour). Local Wi-Fi Direct transfers remain unlimited.",
            isLocalExempt: true
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Retry-After": "3600"
            }
          }
        );
      }

      try {
        const payload = await generateTurnCredentials(room, env.TURN_STATIC_SECRET);
        return new Response(JSON.stringify(payload), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store, no-cache, must-revalidate"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "FAILED_TO_GENERATE_CREDENTIALS" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 3. Cloudflare Turnstile Captcha Verification Endpoint
    if (url.pathname === "/api/v1/verify-turnstile" && request.method === "POST") {
      try {
        const body = await request.json();
        const token = body.token;
        if (!token) {
          return new Response(JSON.stringify({ success: false, error: "Missing token" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // Cloudflare Turnstile Secret Key (read securely from Cloudflare KMS)
        const secretKey = env.TURNSTILE_SECRET_KEY;
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: secretKey,
            response: token,
            remoteip: clientIp
          })
        });

        const verifyData = await verifyRes.json();
        return new Response(JSON.stringify(verifyData), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 4. WebSocket Signaling Forwarder /ws/*
    if (url.pathname.startsWith("/ws/") || url.pathname === "/ws") {
      const parts = url.pathname.split("/").filter(Boolean);
      const room = (parts.length > 1 ? parts[1] : url.searchParams.get("room") || "DEFAULT").toUpperCase();
      const isRadar = room.startsWith("RADAR") || url.searchParams.get("radar") === "true";

      // Rate limit room creations: Max 15 rooms per hour (Local Wi-Fi Radar is completely EXEMPT)
      if (!isRadar && isRateLimited(ipRoomTracker, clientIp, 15, 60 * 60 * 1000)) {
        return new Response(
          "Too many room connections created from this IP (Limit: 15/hr). Local Wi-Fi Direct remains available.",
          { status: 429, headers: { "Retry-After": "3600" } }
        );
      }

      const targetUrl = new URL(url.pathname + url.search, "https://peerwarp-signaling.ahmedkhaled791.workers.dev");
      return fetch(new Request(targetUrl, request));
    }

    // 5. Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "healthy", service: "PeerWarp Cloudflare Edge" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 6. Static Assets fetch
    let response = await env.ASSETS.fetch(request);

    // 7. SPA Dynamic Room Route rewrite: if 404 and no file extension (e.g. /WARP-123)
    if (response.status === 404 && !url.pathname.includes(".")) {
      const connectResponse = await env.ASSETS.fetch(new Request(new URL("/connect/", request.url), request));
      if (connectResponse.status === 200) {
        return connectResponse;
      }
      return env.ASSETS.fetch(new Request(new URL("/", request.url), request));
    }

    return response;
  }
};
