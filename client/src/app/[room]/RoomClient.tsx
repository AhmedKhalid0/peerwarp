"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Zap,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { TransferCard } from "@/components/TransferCard";
import { SignalingClient } from "@/lib/signaling";
import { WebRTCPeer } from "@/lib/webrtc";
import { FileStreamReceiver } from "@/lib/streamer";
import { FileTransferItem, FileMetadataPacket, FileCompletePacket } from "@/types/protocol";

interface RoomClientProps {
  initialRoom: string;
}

export default function RoomClient({ initialRoom }: RoomClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [manualCodeInput, setManualCodeInput] = useState("");

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "waiting_for_sender" | "connected" | "transferring" | "completed" | "error"
  >("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<FileTransferItem | null>(null);

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const receiverStreamerRef = useRef<FileStreamReceiver>(new FileStreamReceiver());

  useEffect(() => {
    setIsMounted(true);
    let resolved = (initialRoom || "").toUpperCase().trim();
    if (typeof window !== "undefined") {
      const pathPart = window.location.pathname.replace(/^\/+/, "").split("/")[0];
      if (pathPart && pathPart.toLowerCase() !== "connect") {
        resolved = pathPart.toUpperCase().trim();
      }
    }
    setRoomId(resolved);
  }, [initialRoom]);

  useEffect(() => {
    if (!isMounted || !roomId || roomId === "CONNECT") {
      return;
    }
    let isActive = true;

    async function initReceiver() {
      try {
        setConnectionStatus("connecting");

        // 1. Initialize Signaling
        const signaling = new SignalingClient(roomId, (envelope) => {
          if (!isActive) return;

          if (envelope.type === "error") {
            setConnectionStatus("error");
            setErrorMessage(envelope.message || "Failed to join room.");
            return;
          }

          if (envelope.type === "peer_left") {
            setConnectionStatus("error");
            setErrorMessage("Sender disconnected from the room.");
            return;
          }

          peerRef.current?.handleSignalingMessage(envelope);
        });
        signalingRef.current = signaling;

        await signaling.connect();

        // 2. Initialize WebRTC as receiver
        const peer = new WebRTCPeer("receiver", signaling, {
          onConnectionStateChange: (state) => {
            console.log("[Receiver WebRTC] Connection state:", state);
            if (state === "connected") {
              setConnectionStatus("connected");
            } else if (state === "disconnected" || state === "failed") {
              setConnectionStatus("error");
              setErrorMessage("P2P direct connection lost.");
            }
          },
          onDataChannelReady: (channel) => {
            console.log("[Receiver DataChannel] Ready!");
            setConnectionStatus("connected");
            setupDataChannelListeners(channel);
          },
          onError: (err) => {
            console.error("[Receiver WebRTC] Error:", err);
            setConnectionStatus("error");
            setErrorMessage(err);
          },
        });
        peerRef.current = peer;
        await peer.initialize();
      } catch (err: any) {
        console.error("Failed to connect receiver:", err);
        if (isActive) {
          setConnectionStatus("error");
          setErrorMessage(err?.message || "Could not connect to signaling server.");
        }
      }
    }

    initReceiver();

    return () => {
      isActive = false;
      signalingRef.current?.close();
      peerRef.current?.close();
    };
  }, [isMounted, roomId]);

  const setupDataChannelListeners = (channel: RTCDataChannel) => {
    channel.onmessage = async (event) => {
      // 1. Control Packet (JSON text)
      if (typeof event.data === "string") {
        try {
          const packet = JSON.parse(event.data);

          if (packet.cmd === "FILE_METADATA") {
            const meta = packet as FileMetadataPacket;
            receiverStreamerRef.current.handleMetadata(meta);

            setActiveItem({
              id: meta.id,
              name: meta.name,
              size: meta.size,
              type: meta.type,
              progress: 0,
              speedBps: 0,
              etaSeconds: 0,
              status: "receiving",
            });
            setConnectionStatus("transferring");
          } else if (packet.cmd === "FILE_COMPLETE") {
            const complete = packet as FileCompletePacket;
            setActiveItem((prev) => (prev ? { ...prev, status: "verifying" } : null));

            // Finalize received blob and verify SHA-256
            const result = await receiverStreamerRef.current.finalize(complete.sha256);
            const downloadUrl = URL.createObjectURL(result.blob);

            setActiveItem((prev) =>
              prev
                ? {
                    ...prev,
                    progress: 100,
                    status: "completed",
                    sha256: result.actualSha256,
                    blobUrl: downloadUrl,
                  }
                : null
            );
            setConnectionStatus("completed");

            // Confetti celebration on completion
            try {
              confetti({
                particleCount: 90,
                spread: 75,
                origin: { y: 0.6 },
              });
            } catch (_) {}
          }
        } catch (err) {
          console.error("Failed to parse control packet:", err);
        }
        return;
      }

      // 2. Binary Chunk (ArrayBuffer)
      if (event.data instanceof ArrayBuffer) {
        receiverStreamerRef.current.handleChunk(event.data, (update) => {
          setActiveItem((prev) =>
            prev
              ? {
                  ...prev,
                  progress: update.progressPercent,
                  speedBps: update.speedBps,
                  etaSeconds: update.etaSeconds,
                }
              : null
          );
        });
      }
    };
  };

  const handleDownload = () => {
    if (!activeItem || !activeItem.blobUrl) return;
    const a = document.createElement("a");
    a.href = activeItem.blobUrl;
    a.download = activeItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isMounted) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to PeerWarp</span>
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4 shadow-xs">
          <Loader2 className="w-9 h-9 text-zinc-500 dark:text-zinc-400 animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Initializing PeerWarp Connection...
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Establishing encrypted peer-to-peer bridge. Please keep this tab open.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8 text-zinc-900 dark:text-zinc-100">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to PeerWarp</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500">
            Room Code
          </span>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
            {roomId || "CONNECT"}
          </span>
        </div>
      </div>

      {/* Main Status Canvas */}
      <div className="space-y-6">
        {/* Manual Code Input if landed on /connect */}
        {(!roomId || roomId === "CONNECT") && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-6 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Receive Files via Room Code
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Enter the 6-character room code (e.g. WARP-482) provided by the sender.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCodeInput.trim()) {
                  const clean = manualCodeInput.trim().toUpperCase();
                  setRoomId(clean);
                  window.history.pushState(null, "", `/${clean}`);
                }
              }}
              className="flex items-center gap-2 max-w-sm mx-auto"
            >
              <input
                type="text"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value.toUpperCase())}
                placeholder="WARP-..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-semibold shadow-xs transition-colors"
              >
                Join
              </button>
            </form>
          </div>
        )}

        {/* Connecting Spinner */}
        {roomId && roomId !== "CONNECT" && connectionStatus === "connecting" && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4 shadow-xs">
            <Loader2 className="w-9 h-9 text-zinc-500 dark:text-zinc-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Connecting to Room {roomId}...
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Establishing direct encrypted peer-to-peer bridge. Please keep this tab open.
              </p>
            </div>
          </div>
        )}

        {/* Connected - Waiting for sender to stream */}
        {connectionStatus === "connected" && !activeItem && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Connected Directly to Sender
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Both devices are paired! Waiting for the sender to stream files.
              </p>
            </div>
          </div>
        )}

        {/* Active Transfer Card */}
        {activeItem && (
          <TransferCard
            item={activeItem}
            isReceiver={true}
            onDownload={handleDownload}
          />
        )}

        {/* Error State */}
        {connectionStatus === "error" && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4 shadow-xs">
            <AlertCircle className="w-9 h-9 text-zinc-500 dark:text-zinc-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Session Notice
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                {errorMessage || "Unable to establish direct peer connection."}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-semibold shadow-xs transition-colors"
            >
              <span>Return Home</span>
            </Link>
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 text-center">
        <ShieldCheck className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
        <span>Transferred data flows directly device-to-device and is never stored on any server.</span>
      </div>
    </div>
  );
}
