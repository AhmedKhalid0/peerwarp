"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Zap,
  ArrowRight,
  Shield,
  HardDrive,
  Wifi,
  Smartphone,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  Check,
  X,
  Lock,
  Cpu,
  Globe,
  UploadCloud,
  QrCode,
  Layers,
  Clock,
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

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const faqs = [
    {
      q: "Where do my files get uploaded?",
      a: "Nowhere! PeerWarp uses WebRTC to establish a direct cryptographic bridge between your browser and the recipient's browser. Your files stream memory-to-memory and are never uploaded to any cloud server or staged on third-party disks.",
    },
    {
      q: "Is there really no file size limit?",
      a: "Yes, 100% free with no file size limits. Because PeerWarp doesn't store your files on cloud disks, there are no artificial 2 GB or 5 GB caps. You can easily stream 500 MB video clips or 40 GB project archives directly.",
    },
    {
      q: "Do I or the receiver need an account or software?",
      a: "No app, no plugin, no email, and no account required. PeerWarp works out-of-the-box in any modern browser including Google Chrome, Safari, Mozilla Firefox, Microsoft Edge, and mobile browsers on iOS and Android.",
    },
    {
      q: "How fast is the transfer?",
      a: "If both devices are connected to the same local Wi-Fi or router, files transfer locally at maximum hardware network speed (50 to 100+ MB/s) consuming zero internet quota. Over the internet, it utilizes your full peer-to-peer connection speed without cloud throttling.",
    },
    {
      q: "Can anyone else intercept or see my files?",
      a: "No. The direct peer-to-peer data channel is encrypted end-to-end using DTLS and SCTP cryptography. Once the transfer completes, the receiver's browser verifies the exact cryptographic SHA-256 hash to ensure no tampering occurred.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-16 text-zinc-900 dark:text-zinc-100">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <span>Direct Device-to-Device • Zero Cloud Storage</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Fast, direct file transfers <br className="hidden sm:inline" />
          with zero cloud storage.
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl mx-auto">
          Send videos, archives, and folders directly from your browser to another device.
          No accounts, no limits, and completely free.
        </p>
      </div>

      {/* Main Mode Switcher (Send / Receive) */}
      {!roomId && (
        <div className="flex justify-center">
          <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab("send")}
              className={`px-5 py-2 rounded-lg transition-all ${
                activeTab === "send"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Send Files
            </button>
            <button
              onClick={() => setActiveTab("receive")}
              className={`px-5 py-2 rounded-lg transition-all ${
                activeTab === "receive"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
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
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-semibold text-sm sm:text-base shadow-xs hover:shadow transition-all scale-100 hover:scale-[1.01] active:scale-[0.99]"
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
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Active Streaming Room
              </span>
              <button
                onClick={handleResetSession}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
          <div className="max-w-md mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xs space-y-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Enter Room Code
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Type the 6-character code shown on the sending screen.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. WARP-482"
                maxLength={8}
                className="w-full text-center text-xl font-mono uppercase tracking-widest px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />

              <button
                type="submit"
                disabled={!joinCodeInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-semibold text-sm shadow-xs transition-colors disabled:opacity-50"
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

      {/* ========================================================= */}
      {/* SECTION 1: HOW IT WORKS FOR NORMAL USERS                  */}
      {/* ========================================================= */}
      <section id="how-it-works" className="pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-10">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Simple & Transparent
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            How PeerWarp Works in 3 Steps
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            No technical knowledge needed. Send anything from your laptop to a phone or friend in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <UploadCloud className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                Select Your Files
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Drag and drop your photos, 4K videos, zip files, or documents. You can add as many files as you like with no size limit.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Nothing is uploaded to any server</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <QrCode className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                Share Link or QR Code
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                PeerWarp generates a quick QR code and a 6-character room code. Scan it with a smartphone camera or copy the private link.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Instant connection across iOS, Android, PC & Mac</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <Zap className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                Direct Memory Streaming
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Data streams straight from browser to browser. As soon as you hit send, the receiver downloads the file in real time.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Encrypted with SHA-256 verification</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: WHY PEERWARP VS TRADITIONAL CLOUD              */}
      {/* ========================================================= */}
      <section id="why-peerwarp" className="space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Comparison
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Why Choose PeerWarp?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            See how direct peer-to-peer streaming compares to traditional cloud file uploaders.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40">
                  <th className="p-4 sm:p-5 font-semibold text-zinc-900 dark:text-zinc-100">Feature</th>
                  <th className="p-4 sm:p-5 font-semibold text-zinc-900 dark:text-zinc-100">PeerWarp (P2P)</th>
                  <th className="p-4 sm:p-5 font-medium text-zinc-500 dark:text-zinc-400">Cloud Storage / WeTransfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">File Storage</td>
                  <td className="p-4 sm:p-5 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Zero cloud storage (in-memory only)
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">Stored on 3rd-party servers for days</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">File Size Limits</td>
                  <td className="p-4 sm:p-5 text-emerald-600 dark:text-emerald-400 font-medium">
                    Unlimited (1 GB, 20 GB, 50 GB+)
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">Capped at 2 GB unless you pay a monthly fee</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">Transfer Flow</td>
                  <td className="p-4 sm:p-5 text-zinc-900 dark:text-zinc-200">
                    Direct stream: receiver downloads immediately
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">Must upload 100% first, then receiver downloads</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">Local Wi-Fi Speed</td>
                  <td className="p-4 sm:p-5 text-zinc-900 dark:text-zinc-200">
                    Gigabit LAN speed (50–100 MB/s, 0 quota used)
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">Limited by your home/office upload bandwidth</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">Privacy & Security</td>
                  <td className="p-4 sm:p-5 text-emerald-600 dark:text-emerald-400 font-medium">
                    End-to-End DTLS/SCTP encryption + SHA-256
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">Server holds decryption keys & logs IP</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-100">Price & Sign-up</td>
                  <td className="p-4 sm:p-5 text-emerald-600 dark:text-emerald-400 font-medium">
                    100% Free, no account, no email needed
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-500 dark:text-zinc-400">Requires registration or paid plan</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 3: FREQUENTLY ASKED QUESTIONS (FAQ)               */}
      {/* ========================================================= */}
      <section id="faq" className="space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Clear Answers
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Everything you need to know about safety, privacy, and how PeerWarp operates.
          </p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-zinc-900 dark:text-zinc-100" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer / Trust Guarantee */}
      <footer className="pt-12 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            Zero Data Stored
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-zinc-500" />
            DTLS 1.3 / SCTP Encrypted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-zinc-500" />
            64KB Backpressure Engine
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-zinc-500" />
            100% Free Open Source
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          PeerWarp is an open-source peer-to-peer file transfer utility. No files, logs, or analytics cookies are ever collected.
        </p>
      </footer>
    </div>
  );
}
