"""Pydantic v2 schemas for the PeerWarp signaling protocol."""

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class MessageType(str, Enum):
    JOIN = "join"
    JOINED = "joined"
    OFFER = "offer"
    ANSWER = "answer"
    ICE_CANDIDATE = "ice_candidate"
    LEAVE = "leave"
    PEER_LEFT = "peer_left"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"


class PeerRole(str, Enum):
    INITIATOR = "initiator"
    RECEIVER = "receiver"


class SignalingMessage(BaseModel):
    """Universal envelope for peer-to-peer signaling over WebSockets."""

    type: MessageType
    room_id: Optional[str] = Field(None, description="Alphanumeric room identifier")
    role: Optional[PeerRole] = Field(None, description="Role assigned to this peer")
    payload: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="SDP offer/answer or ICE candidate dictionary",
    )
    message: Optional[str] = Field(None, description="Descriptive status or error message")
    peer_count: Optional[int] = Field(None, description="Current number of peers in the room")


class RoomInfo(BaseModel):
    """Metadata response for active room inspection."""

    room_id: str
    peer_count: int
    created_at: float
    is_full: bool
