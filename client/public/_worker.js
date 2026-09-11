export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. WebSocket Signaling Forwarder /ws/*
    if (url.pathname.startsWith('/ws/') || url.pathname === '/ws') {
      const targetUrl = new URL(url.pathname + url.search, 'https://peerwarp-signaling.ahmedkhaled791.workers.dev');
      return fetch(new Request(targetUrl, request));
    }

    // 2. Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: "healthy", service: "PeerWarp Cloudflare Edge" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Static Assets fetch
    let response = await env.ASSETS.fetch(request);

    // 4. SPA Dynamic Room Route rewrite: if 404 and no file extension (e.g. /WARP-123)
    if (response.status === 404 && !url.pathname.includes('.')) {
      const connectResponse = await env.ASSETS.fetch(new Request(new URL('/connect/', request.url), request));
      if (connectResponse.status === 200) {
        return connectResponse;
      }
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }

    return response;
  }
};
