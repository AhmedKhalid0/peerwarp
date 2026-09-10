"""Room management and peer pairing state machine for PeerWarp."""

import time
import logging
from typing import Dict, List, Optional, Tuple
from fastapi import WebSocket

from app.schemas import PeerRole

logger = logging.getLogger("peerwarp.rooms")


class Room:
    """Represents an active ephemeral pairing session between two peers."""

    def __init__(self, room_id: str):
        self.room_id: str = room_id
        self.peers: List[WebSocket] = []
        self.created_at: float = time.time()
        self.last_active: float = time.time()

    @property
    def peer_count(self) -> int:
        return len(self.peers)

    @property
    def is_full(self) -> bool:
        return len(self.peers) >= 2


class RoomManager:
    """Manages active WebRTC signaling rooms and handles peer lifecycle events."""

    def __init__(self):
        self._rooms: Dict[str, Room] = {}
        self._socket_to_room: Dict[WebSocket, str] = {}

    def get_room(self, room_id: str) -> Optional[Room]:
        return self._rooms.get(room_id)

    def join_room(self, room_id: str, websocket: WebSocket) -> Tuple[PeerRole, int]:
        """Adds a peer to a room, assigning them initiator or receiver role."""
        if room_id not in self._rooms:
            self._rooms[room_id] = Room(room_id)

        room = self._rooms[room_id]

        if room.is_full and websocket not in room.peers:
            raise ValueError(f"Room '{room_id}' is already full (maximum 2 peers allowed).")

        if websocket not in room.peers:
            room.peers.append(websocket)
            self._socket_to_room[websocket] = room_id

        room.last_active = time.time()
        role = PeerRole.INITIATOR if len(room.peers) == 1 else PeerRole.RECEIVER
        return role, len(room.peers)

    def get_other_peer(self, websocket: WebSocket) -> Optional[WebSocket]:
        """Finds the counterpart peer in the same room."""
        room_id = self._socket_to_room.get(websocket)
        if not room_id:
            return None

        room = self._rooms.get(room_id)
        if not room:
            return None

        for peer in room.peers:
            if peer != websocket:
                return peer
        return None

    def remove_peer(self, websocket: WebSocket) -> Optional[Tuple[str, Optional[WebSocket]]]:
        """Removes a peer upon disconnect and notifies counterpart or cleans up empty rooms."""
        room_id = self._socket_to_room.pop(websocket, None)
        if not room_id:
            return None

        room = self._rooms.get(room_id)
        if not room:
            return None

        if websocket in room.peers:
            room.peers.remove(websocket)

        other_peer: Optional[WebSocket] = room.peers[0] if room.peers else None

        if not room.peers:
            # Delete empty room
            del self._rooms[room_id]
            logger.info("Room '%s' cleaned up (0 active peers).", room_id)
        else:
            room.last_active = time.time()

        return room_id, other_peer

    def get_active_rooms_count(self) -> int:
        return len(self._rooms)

    def get_total_connected_peers(self) -> int:
        return len(self._socket_to_room)
