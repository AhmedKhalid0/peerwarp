"use client";

import React, { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Zap,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ShieldCheck,
  Smartphone,
  HardDrive,
} from "lucide-react";
import { TransferCard } from "@/components/TransferCard";
import { AdSlot } from "@/components/AdSlot";
import { SignalingClient } from "@/lib/signaling";
import { WebRTCPeer } from "@/lib/webrtc";
import { FileStreamReceiver } from "@/lib/streamer";
import { FileTransferItem, FileMetadataPacket, FileCompletePacket } from "@/types/protocol";

interface RoomPageProps {
  params: Promise<{ room: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.room.toUpperCase().trim();

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "waiting_for_sender" | "connected" | "transferring" | "completed" | "error"
  >("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<FileTransferItem | null>(null);

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const receiverStreamerRef = useRef<FileStreamReceiver>(new FileStreamReceiver());

  useEffect(() => {
    let isMounted = true;

    async function initReceiver() {
      try {
        setConnectionStatus("connecting");

        // 1. Initialize Signaling
        const signaling = new SignalingClient(roomId, (envelope) => {
          if (!isMounted) return;

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
        if (isMounted) {
          setConnectionStatus("error");
          setErrorMessage(err?.message || "Could not connect to signaling server.");
        }
      }
    }

    initReceiver();

    return () => {
      isMounted = false;
      signalingRef.current?.close();
      peerRef.current?.close();
    };
  }, [roomId]);

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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to PeerWarp</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
            Room Code
          </span>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-zinc-700">
            {roomId}
          </span>
        </div>
      </div>

      {/* Main Status Canvas */}
      <div className="space-y-6">
        {/* Connecting Spinner */}
        {connectionStatus === "connecting" && (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Connecting to Room {roomId}...
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Negotiating encrypted WebRTC P2P direct handshake.
              </p>
            </div>
          </div>
        )}

        {/* Connected - Waiting for sender to stream */}
        {connectionStatus === "connected" && !activeItem && (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Connected Directly to Sender
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Waiting for the sender to stream files. Keep this window open.
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
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-100">
                Connection Notice
              </h3>
              <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 max-w-md mx-auto">
                {errorMessage || "Unable to establish direct peer connection."}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
            >
              <span>Return Home</span>
            </Link>
          </div>
        )}
      </div>

      {/* Google AdSense / Sponsor Slot Container */}
      <AdSlot slotId="peerwarp_receiver_bottom" />

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-zinc-500 text-center">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Transferred data is end-to-end encrypted and never stored on any server.</span>
      </div>
    </div>
  );
}
