"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Zap,
  ArrowRight,
  Shield,
  HardDrive,
  Wifi,
  Sparkles,
  Smartphone,
  RefreshCw,
  Share2,
} from "lucide-react";
import { DropZone } from "@/components/DropZone";
import { FileQueue } from "@/components/FileQueue";
import { PairingModal } from "@/components/PairingModal";
import { TransferCard } from "@/components/TransferCard";
import { AdSlot } from "@/components/AdSlot";
import { SignalingClient } from "@/lib/signaling";
import { WebRTCPeer } from "@/lib/webrtc";
import { FileStreamSender } from "@/lib/streamer";
import { FileTransferItem } from "@/types/protocol";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState("");

  // Sender session state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [peerCount, setPeerCount] = useState(1);
  const [transferItems, setTransferItems] = useState<FileTransferItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // WebRTC & Signaling references
  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const senderStreamerRef = useRef<FileStreamSender | null>(null);

  // Clean up WebRTC on unmount
  useEffect(() => {
    return () => {
      signalingRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  const generateRoomId = () => {
    const num = Math.floor(100 + Math.random() * 900);
    return `WARP-${num}`;
  };

  const handleStartSending = async () => {
    if (selectedFiles.length === 0) return;

    const newRoomId = generateRoomId();
    setRoomId(newRoomId);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setShareUrl(`${origin}/${newRoomId}`);

    // Prepare transfer queue
    const items: FileTransferItem[] = selectedFiles.map((file, idx) => ({
      id: `file-${idx}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      progress: 0,
      speedBps: 0,
      etaSeconds: 0,
      status: "ready",
    }));
    setTransferItems(items);

    // Initialize Signaling
    const signaling = new SignalingClient(newRoomId, (envelope) => {
      if (envelope.type === "joined" && envelope.peerCount) {
        setPeerCount(envelope.peerCount);
      }
      if (envelope.type === "peer_left") {
        setPeerCount(1);
      }
      peerRef.current?.handleSignalingMessage(envelope);
    });
    signalingRef.current = signaling;

    try {
      await signaling.connect();

      // Initialize WebRTC as initiator
      const peer = new WebRTCPeer("initiator", signaling, {
        onConnectionStateChange: (state) => {
          console.log("[WebRTC] Connection state:", state);
        },
        onDataChannelReady: (channel) => {
          console.log("[DataChannel] Ready! Starting stream...");
          startStreamingFiles(channel, items);
        },
        onError: (err) => {
          console.error("[WebRTC] Peer error:", err);
        },
      });
      peerRef.current = peer;
      await peer.initialize();
    } catch (err) {
      console.error("[Signaling] Connection failed:", err);
    }
  };

  const startStreamingFiles = async (channel: RTCDataChannel, items: FileTransferItem[]) => {
    const streamer = new FileStreamSender(channel);
    senderStreamerRef.current = streamer;

    for (let i = 0; i < items.length; i++) {
      setActiveItemIndex(i);
      const current = items[i];
      if (!current.file) continue;

      // Update state to sending
      setTransferItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "sending" } : item))
      );

      try {
        const finalSha256 = await streamer.sendFile(current.file, (update) => {
          setTransferItems((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    progress: update.progressPercent,
                    speedBps: update.speedBps,
                    etaSeconds: update.etaSeconds,
                  }
                : item
            )
          );
        });

        // Mark completed
        setTransferItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "completed",
                  progress: 100,
                  sha256: finalSha256,
                }
              : item
          )
        );
      } catch (err: any) {
        console.error("File stream failed:", err);
        setTransferItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "error", error: err?.message } : item
          )
        );
        break;
      }
    }

    // Trigger celebration confetti on all files completed
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (_) {}
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const clean = joinCodeInput.trim().toUpperCase();
    window.location.href = `/${clean}`;
  };

  const handleResetSession = () => {
    signalingRef.current?.close();
    peerRef.current?.close();
    setRoomId(null);
    setShareUrl("");
    setPeerCount(1);
    setSelectedFiles([]);
    setTransferItems([]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-zinc-900 border border-indigo-100 dark:border-zinc-800 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Serverless WebRTC • Zero Cloud Storage</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
          Direct P2P File Transfer. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-800 dark:from-indigo-400 dark:to-indigo-300">
            Unlimited Size. Zero Limits.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
          Stream multi-gigabyte videos, archives, and folders directly from device to device.
          No cloud storage, no registration, and 100% free forever.
        </p>
      </div>

      {/* Main Mode Switcher (Send / Receive) */}
      {!roomId && (
        <div className="flex justify-center">
          <div className="p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-1 text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab("send")}
              className={`px-5 py-2 rounded-lg transition-all ${
                activeTab === "send"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Send Files
            </button>
            <button
              onClick={() => setActiveTab("receive")}
              className={`px-5 py-2 rounded-lg transition-all ${
                activeTab === "receive"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Receive Files
            </button>
          </div>
        </div>
      )}

      {/* Main Interaction Canvas */}
      <div className="space-y-6">
        {/* SEND TAB */}
        {activeTab === "send" && !roomId && (
          <div className="space-y-6">
            <DropZone
              onFilesSelected={(newFiles) =>
                setSelectedFiles((prev) => [...prev, ...newFiles])
              }
            />

            {selectedFiles.length > 0 && (
              <div className="space-y-5">
                <FileQueue
                  files={selectedFiles}
                  onRemoveFile={(idx) =>
                    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                  onClearAll={() => setSelectedFiles([])}
                />

                <div className="flex justify-center">
                  <button
                    onClick={handleStartSending}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm sm:text-base shadow-sm hover:shadow transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Create Transfer Room & QR Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE SENDER SESSION */}
        {roomId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Active Streaming Room
              </span>
              <button
                onClick={handleResetSession}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Start New Transfer
              </button>
            </div>

            {/* Pairing Modal with Code and QR */}
            <PairingModal
              roomId={roomId}
              shareUrl={shareUrl}
              peerCount={peerCount}
            />

            {/* Active Transfer Cards */}
            {transferItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Transfer Progress ({activeItemIndex + 1}/{transferItems.length})
                </h3>
                {transferItems.map((item) => (
                  <TransferCard
                    key={item.id}
                    item={item}
                    isReceiver={false}
                    onCancel={() => senderStreamerRef.current?.cancel()}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* RECEIVE TAB */}
        {activeTab === "receive" && !roomId && (
          <div className="max-w-md mx-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm space-y-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Enter Room Code
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Type the 6-character code shown on the sending device.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. WARP-482"
                maxLength={8}
                className="w-full text-center text-xl font-mono uppercase tracking-widest px-4 py-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={!joinCodeInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition-colors disabled:opacity-50"
              >
                <span>Connect & Download</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Google AdSense / Sponsor Slot Container */}
      <AdSlot slotId="peerwarp_homepage_bottom" />

      {/* Architectural Pillars / Value Props */}
      <div className="pt-6 border-t border-slate-200/60 dark:border-zinc-800/60 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="space-y-2 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
            Zero Cloud Storage
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Data flows directly through in-memory WebRTC DataChannels. Your files are never uploaded to any server or staged on third-party disks.
          </p>
        </div>

        <div className="space-y-2 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
            Gigabit LAN Speeds
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            When peers are on the same Wi-Fi or router, data routes locally at network wire speed (50–100 MB/s) consuming zero internet bandwidth.
          </p>
        </div>

        <div className="space-y-2 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
            End-to-End Encrypted
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Secured with DTLS/SCTP cryptographic tunneling and verified with client-side Web Crypto SHA-256 digests on completion.
          </p>
        </div>
      </div>
    </div>
  );
}
