export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Canonical 301 Permanent Redirect (SEO & Duplicate Content Prevention)
    // Redirects all *.pages.dev and www.peerwarp.com requests to the canonical https://peerwarp.com
    if (
      (url.hostname.endsWith(".pages.dev") || url.hostname === "www.peerwarp.com") &&
      !url.pathname.startsWith("/ws")
    ) {
      const canonicalUrl = new URL(request.url);
      canonicalUrl.hostname = "peerwarp.com";
      canonicalUrl.protocol = "https:";
      canonicalUrl.port = "";
      return Response.redirect(canonicalUrl.toString(), 301);
    }

    // 2. WebSocket Signaling Forwarder /ws/*
    if (url.pathname.startsWith("/ws/") || url.pathname === "/ws") {
      const targetUrl = new URL(url.pathname + url.search, "https://peerwarp-signaling.ahmedkhaled791.workers.dev");
      return fetch(new Request(targetUrl, request));
    }

    // 3. Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "healthy", service: "PeerWarp Cloudflare Edge" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Static Assets fetch
    let response = await env.ASSETS.fetch(request);

    // 5. SPA Dynamic Room Route rewrite: if 404 and no file extension (e.g. /WARP-123)
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
