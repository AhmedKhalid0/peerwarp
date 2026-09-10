"""FastAPI application providing WebRTC signaling and health endpoints for PeerWarp."""

import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.rooms import RoomManager
from app.schemas import MessageType, SignalingMessage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("peerwarp.server")

room_manager = RoomManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PeerWarp Standalone Signaling Server initialized.")
    yield
    logger.info("PeerWarp Standalone Signaling Server shut down.")


app = FastAPI(
    title="PeerWarp Signaling API",
    description="High-performance, zero-storage WebRTC signaling server for PeerWarp P2P file transfers.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "PeerWarp Signaling Engine",
        "status": "online",
        "version": "1.0.0",
        "active_rooms": room_manager.get_active_rooms_count(),
        "connected_peers": room_manager.get_total_connected_peers(),
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}


@app.get("/api/v1/stats", tags=["Monitoring"])
async def get_stats():
    return {
        "active_rooms": room_manager.get_active_rooms_count(),
        "connected_peers": room_manager.get_total_connected_peers(),
        "storage_utilized_bytes": 0,  # PeerWarp guarantees 0 bytes server storage
        "mode": "zero_cloud_storage_p2p",
    }


@app.websocket("/ws/{room_id}")
async def websocket_signaling_endpoint(websocket: WebSocket, room_id: str):
    """Primary WebSocket signaling channel for peer discovery and WebRTC handshake."""
    await websocket.accept()
    clean_room_id = room_id.strip().upper()

    try:
        role, peer_count = room_manager.join_room(clean_room_id, websocket)
        logger.info("Peer joined room '%s' as %s (peer count: %d)", clean_room_id, role, peer_count)

        # Confirm join to the connected peer
        joined_msg = SignalingMessage(
            type=MessageType.JOINED,
            room_id=clean_room_id,
            role=role,
            peer_count=peer_count,
            message=f"Successfully joined room {clean_room_id}",
        )
        await websocket.send_text(joined_msg.model_dump_json())

        # If this is the second peer (receiver), notify the first peer (initiator) that peer joined
        other_peer = room_manager.get_other_peer(websocket)
        if other_peer:
            peer_arrived_msg = SignalingMessage(
                type=MessageType.JOINED,
                room_id=clean_room_id,
                peer_count=2,
                message="A remote peer has connected to the room",
            )
            await other_peer.send_text(peer_arrived_msg.model_dump_json())

        # Main message relay loop
        while True:
            raw_text = await websocket.receive_text()
            try:
                data: Dict[str, Any] = json.loads(raw_text)
                msg_type = data.get("type")

                # Handle heartbeats
                if msg_type == MessageType.PING:
                    pong_msg = SignalingMessage(type=MessageType.PONG, room_id=clean_room_id)
                    await websocket.send_text(pong_msg.model_dump_json())
                    continue

                # Forward signaling payloads (offer, answer, ice_candidate) to the other peer
                target_peer = room_manager.get_other_peer(websocket)
                if target_peer:
                    await target_peer.send_text(raw_text)
                else:
                    if msg_type in (MessageType.OFFER, MessageType.ANSWER, MessageType.ICE_CANDIDATE):
                        logger.debug("Received %s but other peer is not yet connected in room %s", msg_type, clean_room_id)

            except json.JSONDecodeError:
                err_msg = SignalingMessage(type=MessageType.ERROR, message="Invalid JSON envelope.")
                await websocket.send_text(err_msg.model_dump_json())

    except ValueError as ve:
        logger.warning("Rejected connection to room '%s': %s", clean_room_id, str(ve))
        err_msg = SignalingMessage(type=MessageType.ERROR, message=str(ve))
        await websocket.send_text(err_msg.model_dump_json())
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)

    except WebSocketDisconnect:
        cleanup_result = room_manager.remove_peer(websocket)
        if cleanup_result:
            r_id, remaining_peer = cleanup_result
            logger.info("Peer disconnected from room '%s'", r_id)
            if remaining_peer:
                left_msg = SignalingMessage(
                    type=MessageType.PEER_LEFT,
                    room_id=r_id,
                    message="Remote peer has disconnected.",
                )
                try:
                    await remaining_peer.send_text(left_msg.model_dump_json())
                except Exception:
                    pass

    except Exception as exc:
        logger.error("Unexpected error in signaling handler: %s", exc, exc_info=True)
        room_manager.remove_peer(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
