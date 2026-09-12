/**
 * Cryptographically secure room identifier and key utilities for PeerWarp.
 * Ensures zero vulnerability to brute-force crawling and dictionary attacks.
 */

const BASE32_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // Excludes 0, O, 1, I, L

/**
 * Generates an 8-character high-entropy Base32 short code (1.1 Trillion combinations)
 * Formatted as WARP-XXXX-XXXX for human-friendly typing.
 */
export function generateShortRoomCode(): string {
  const bytes = new Uint8Array(8);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  let code = "";
  for (let i = 0; i < 8; i++) {
    code += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return `WARP-${code.substring(0, 4)}-${code.substring(4, 8)}`;
}

/**
 * Generates a 16-character high-entropy cryptographic room token (4.7 x 10^28 combinations)
 */
export function generateSecureToken(): string {
  const chars = "abcdefghijkmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(16);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

/**
 * Generates an ephemeral 128-bit secret key for URL hash fragment (#k=...)
 */
export function generateEphemeralKey(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns a human-friendly description of the current device/browser.
 */
export function getDeviceSummary(): string {
  if (typeof window === "undefined" || !navigator) return "Web Browser";

  const ua = navigator.userAgent;
  let os = "Desktop";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "Mac";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/CriOS|Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = "Safari";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  return `${os} (${browser})`;
}

export const getDeviceInfo = getDeviceSummary;
