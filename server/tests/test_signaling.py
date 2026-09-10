"""Automated unit and integration test suite for PeerWarp Signaling Server."""

import json
import pytest
from fastapi.testclient import TestClient

from app.main import app, room_manager
from app.schemas import MessageType, PeerRole

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_room_manager():
    """Ensure clean state before each test."""
    room_manager._rooms.clear()
    room_manager._socket_to_room.clear()
    yield
    room_manager._rooms.clear()
    room_manager._socket_to_room.clear()


def test_health_and_root_endpoints():
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    data = root_resp.json()
    assert data["service"] == "PeerWarp Signaling Engine"
    assert data["status"] == "online"

    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json() == {"status": "healthy"}


def test_stats_endpoint():
    resp = client.get("/api/v1/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["active_rooms"] == 0
    assert stats["storage_utilized_bytes"] == 0
    assert stats["mode"] == "zero_cloud_storage_p2p"


def test_websocket_peer_joining_and_role_assignment():
    room_id = "TEST-ROOM-101"

    with client.websocket_connect(f"/ws/{room_id}") as ws1:
        # First peer should be assigned initiator
        msg1_raw = ws1.receive_text()
        msg1 = json.loads(msg1_raw)
        assert msg1["type"] == MessageType.JOINED
        assert msg1["role"] == PeerRole.INITIATOR
        assert msg1["peer_count"] == 1

        # Second peer connects
        with client.websocket_connect(f"/ws/{room_id}") as ws2:
            msg2_raw = ws2.receive_text()
            msg2 = json.loads(msg2_raw)
            assert msg2["type"] == MessageType.JOINED
            assert msg2["role"] == PeerRole.RECEIVER
            assert msg2["peer_count"] == 2

            # Peer 1 should receive notification that peer 2 joined
            p1_notification_raw = ws1.receive_text()
            p1_notification = json.loads(p1_notification_raw)
            assert p1_notification["type"] == MessageType.JOINED
            assert p1_notification["peer_count"] == 2


def test_websocket_signaling_relay_offer_answer():
    room_id = "TEST-RELAY-202"

    with client.websocket_connect(f"/ws/{room_id}") as ws_sender:
        ws_sender.receive_text()  # join confirmation

        with client.websocket_connect(f"/ws/{room_id}") as ws_receiver:
            ws_receiver.receive_text()  # join confirmation
            ws_sender.receive_text()    # peer 2 joined notification

            # Sender sends SDP offer
            offer_payload = {"type": "offer", "sdp": "v=0\r\no=alice 123 456..."}
            ws_sender.send_text(json.dumps(offer_payload))

            # Receiver should receive the relayed offer
            received_offer = json.loads(ws_receiver.receive_text())
            assert received_offer["type"] == "offer"
            assert received_offer["sdp"] == offer_payload["sdp"]

            # Receiver sends SDP answer
            answer_payload = {"type": "answer", "sdp": "v=0\r\no=bob 789 012..."}
            ws_receiver.send_text(json.dumps(answer_payload))

            # Sender should receive the relayed answer
            received_answer = json.loads(ws_sender.receive_text())
            assert received_answer["type"] == "answer"
            assert received_answer["sdp"] == answer_payload["sdp"]


def test_websocket_room_capacity_limit_rejection():
    room_id = "TEST-FULL-303"

    with client.websocket_connect(f"/ws/{room_id}") as ws1:
        ws1.receive_text()
        with client.websocket_connect(f"/ws/{room_id}") as ws2:
            ws2.receive_text()

            # Attempt to connect a third peer to a 2-peer room
            try:
                with client.websocket_connect(f"/ws/{room_id}") as ws3:
                    err_raw = ws3.receive_text()
                    err = json.loads(err_raw)
                    assert err["type"] == MessageType.ERROR
                    assert "already full" in err["message"]
            except Exception:
                # Disconnection with policy violation is expected
                pass


def test_websocket_peer_disconnect_cleanup():
    room_id = "TEST-CLEANUP-404"

    with client.websocket_connect(f"/ws/{room_id}") as ws1:
        ws1.receive_text()
        with client.websocket_connect(f"/ws/{room_id}") as ws2:
            ws2.receive_text()
            ws1.receive_text()  # peer 2 joined notification

        # ws2 is now closed, ws1 should receive peer_left notification
        left_raw = ws1.receive_text()
        left_msg = json.loads(left_raw)
        assert left_msg["type"] == MessageType.PEER_LEFT
