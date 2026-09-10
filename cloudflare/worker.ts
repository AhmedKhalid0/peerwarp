/**
 * PeerWarp Cloudflare Worker - Serverless WebRTC Signaling Engine
 *
 * Runs on Cloudflare's global edge network at 0 cost under the free tier.
 * Manages ephemeral room pairings and relays SDP Offer/Answer and ICE candidates.
 */

interface PeerSession {
  socket: WebSocket;
  role: "initiator" | "receiver";
  roomId: string;
}

// In-memory room registry across edge executions
const rooms = new Map<string, WebSocket[]>();

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          service: "PeerWarp Cloudflare Edge Signaling",
          status: "healthy",
          mode: "serverless_webrtc_edge",
          timestamp: Date.now(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // WebSocket upgrade check
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("PeerWarp Signaling Endpoint. Requires WebSocket connection.", { status: 426 });
    }

    // Extract room id from pathname: /ws/:roomId
    const parts = url.pathname.split("/").filter(Boolean);
    const roomId = (parts.length > 1 ? parts[1] : url.searchParams.get("room") || "DEFAULT").toUpperCase();

    // Create client/server WebSocket pair
    const pair = new WebSocketPair();
    const [clientSocket, serverSocket] = Object.values(pair);

    serverSocket.accept();

    // Handle room registration
    let roomPeers = rooms.get(roomId);
    if (!roomPeers) {
      roomPeers = [];
      rooms.set(roomId, roomPeers);
    }

    if (roomPeers.length >= 2) {
      serverSocket.send(
        JSON.stringify({
          type: "error",
          message: `Room '${roomId}' is already full (maximum 2 peers).`,
        })
      );
      serverSocket.close(1008, "Room full");
      return new Response(null, { status: 101, webSocket: clientSocket });
    }

    roomPeers.push(serverSocket);
    const role = roomPeers.length === 1 ? "initiator" : "receiver";

    // Send joined confirmation
    serverSocket.send(
      JSON.stringify({
        type: "joined",
        roomId,
        role,
        peerCount: roomPeers.length,
        message: `Joined room ${roomId} as ${role}`,
      })
    );

    // Notify other peer if second peer arrived
    if (roomPeers.length === 2) {
      const otherPeer = roomPeers[0];
      try {
        otherPeer.send(
          JSON.stringify({
            type: "joined",
            roomId,
            peerCount: 2,
            message: "A remote peer has connected",
          })
        );
      } catch (_) {}
    }

    // Forward incoming messages to counterpart peer
    serverSocket.addEventListener("message", (event) => {
      try {
        const raw = event.data as string;
        const parsed = JSON.parse(raw);

        // Heartbeat responder
        if (parsed.type === "ping") {
          serverSocket.send(JSON.stringify({ type: "pong", roomId }));
          return;
        }

        // Forward to the counterpart in the room
        const currentPeers = rooms.get(roomId) || [];
        for (const peer of currentPeers) {
          if (peer !== serverSocket) {
            peer.send(raw);
          }
        }
      } catch (err) {
        serverSocket.send(JSON.stringify({ type: "error", message: "Malformed JSON payload" }));
      }
    });

    // Cleanup on disconnect
    const cleanup = () => {
      const currentPeers = rooms.get(roomId) || [];
      const idx = currentPeers.indexOf(serverSocket);
      if (idx !== -1) {
        currentPeers.splice(idx, 1);
      }
      if (currentPeers.length === 0) {
        rooms.delete(roomId);
      } else {
        // Notify remaining peer
        try {
          currentPeers[0].send(
            JSON.stringify({
              type: "peer_left",
              roomId,
              message: "Remote peer disconnected",
            })
          );
        } catch (_) {}
      }
    };

    serverSocket.addEventListener("close", cleanup);
    serverSocket.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: clientSocket });
  },
};
