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
  Lock,
  Cpu,
  Globe,
  UploadCloud,
  QrCode,
  CheckCircle2,
  FileCheck2,
  AlertCircle,
  Users,
  Plus,
  Minus,
  Radio,
  Download,
} from "lucide-react";
import { DropZone } from "@/components/DropZone";
import { FileQueue } from "@/components/FileQueue";
import { PairingModal } from "@/components/PairingModal";
import { TransferCard } from "@/components/TransferCard";
import { KnockApprovalModal } from "@/components/KnockApprovalModal";
import { ConnectedPeersList } from "@/components/ConnectedPeersList";
import { LocalRadar } from "@/components/LocalRadar";
import { SignalingClient } from "@/lib/signaling";
import { WebRTCPeer } from "@/lib/webrtc";
import { FileStreamSender } from "@/lib/streamer";
import { FileTransferItem, RecipientPeer } from "@/types/protocol";
import { wakeLock } from "@/lib/wakelock";
import { generateShortRoomCode, generateEphemeralKey } from "@/lib/id";
import { initPwaInstallPrompt, promptPwaInstall, getAndClearSharedFiles } from "@/lib/pwa";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB limit

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"send" | "receive" | "radar">("send");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sizeLimitWarning, setSizeLimitWarning] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [radarInvite, setRadarInvite] = useState<any | null>(null);

  // Multi-user & Privacy settings
  const [maxRecipients, setMaxRecipients] = useState<number>(5);
  const [requireApproval, setRequireApproval] = useState<boolean>(true);
  const [pendingKnock, setPendingKnock] = useState<{ peerId: string; deviceInfo: string } | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<RecipientPeer[]>([]);

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

  // Handle PWA share target intake and install prompt
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("shared=true")) {
      getAndClearSharedFiles().then((shared) => {
        if (shared && shared.length > 0) {
          setSelectedFiles((prev) => [...prev, ...shared]);
          window.history.replaceState(null, "", "/");
        }
      });
    }

    initPwaInstallPrompt(() => {
      setCanInstallPwa(true);
    });

    return () => {
      signalingRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  const handleStartSending = async (
    filesOverride?: File[],
    options?: { autoApprove?: boolean; roomId?: string; secretKey?: string }
  ) => {
    const filesToUse = filesOverride && filesOverride.length > 0 ? filesOverride : selectedFiles;
    if (filesToUse.length === 0) return null;

    if (filesOverride && filesOverride.length > 0) {
      setSelectedFiles(filesOverride);
    }

    // Generate high-entropy 8-character Base32 room code + 128-bit hash key OR use pre-generated
    const newRoomId = options?.roomId || generateShortRoomCode();
    const secretKey = options?.secretKey || generateEphemeralKey();
    setRoomId(newRoomId);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setShareUrl(`${origin}/${newRoomId}#k=${secretKey}`);

    // Prepare transfer queue
    const items: FileTransferItem[] = filesToUse.map((file, idx) => ({
      id: `file-${idx}`,
      file,
      name: file.name,
      relativePath: (file as any).relativePath || file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      progress: 0,
      speedBps: 0,
      etaSeconds: 0,
      status: "ready",
    }));
    setTransferItems(items);
    setConnectedPeers([]);

    const shouldRequireApproval = options?.autoApprove ? false : requireApproval;

    // Initialize Signaling with multi-peer support
    const signaling = new SignalingClient(newRoomId, (envelope) => {
      if (envelope.type === "joined" && envelope.peerCount) {
        setPeerCount(envelope.peerCount);
      }
      if (envelope.type === "knock") {
        if (options?.autoApprove && envelope.peerId) {
          signaling.approvePeer(envelope.peerId);
        } else {
          setPendingKnock({
            peerId: envelope.peerId!,
            deviceInfo: envelope.deviceInfo || "Mobile / Web Device",
          });
        }
      }
      if (envelope.type === "peer_approved") {
        setConnectedPeers((prev) => [
          ...prev.filter((p) => p.peerId !== envelope.peerId),
          {
            peerId: envelope.peerId!,
            deviceInfo: envelope.deviceInfo || "Colleague",
            joinedAt: Date.now(),
            approved: true,
            status: "connected",
            progress: 0,
            speedBps: 0,
          },
        ]);
      }
      if (envelope.type === "peer_left") {
        if (envelope.peerId) {
          setConnectedPeers((prev) => prev.filter((p) => p.peerId !== envelope.peerId));
        } else {
          setPeerCount(1);
        }
      }
      peerRef.current?.handleSignalingMessage(envelope);
    });
    signalingRef.current = signaling;

    try {
      await signaling.connect();
      // Configure room capacity and knock-to-join gate
      signaling.configureRoom(maxRecipients, shouldRequireApproval);

      // Initialize WebRTC as initiator (Star topology)
      const peer = new WebRTCPeer("initiator", signaling, {
        onConnectionStateChange: (state, peerId) => {
          console.log("[WebRTC Host] Peer state change:", peerId, state);
        },
        onDataChannelReady: (channel, peerId) => {
          console.log("[DataChannel] Ready for peer:", peerId);
          if (!senderStreamerRef.current) {
            const streamer = new FileStreamSender(channel);
            senderStreamerRef.current = streamer;
            startStreamingFiles(streamer, items);
          } else {
            senderStreamerRef.current.addChannel(channel);
          }
        },
        onPeerDisconnected: (peerId) => {
          setConnectedPeers((prev) => prev.filter((p) => p.peerId !== peerId));
        },
        onError: (err, peerId) => {
          console.error("[WebRTC Host] Error on peer:", peerId, err);
        },
      });
      peerRef.current = peer;
      await peer.initialize();
    } catch (err) {
      console.error("[Signaling] Connection failed:", err);
    }

    return { roomId: newRoomId, secretKey };
  };

  const handleApproveKnock = (peerId: string) => {
    signalingRef.current?.approvePeer(peerId);
    setPendingKnock(null);
  };

  const handleRejectKnock = (peerId: string) => {
    signalingRef.current?.rejectPeer(peerId);
    setPendingKnock(null);
  };

  const handleDisconnectPeer = (peerId: string) => {
    peerRef.current?.disconnectPeer(peerId);
    signalingRef.current?.rejectPeer(peerId);
    setConnectedPeers((prev) => prev.filter((p) => p.peerId !== peerId));
  };

  const startStreamingFiles = async (streamer: FileStreamSender, items: FileTransferItem[]) => {
    senderStreamerRef.current = streamer;

    // Acquire screen wake lock to prevent mobile display sleep during transfer
    await wakeLock.request();

    try {
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
    } finally {
      wakeLock.release();
    }

    // Trigger celebration confetti on all files completed
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#10b981", "#3b82f6", "#6366f1"],
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
      q: "Where do my files get uploaded on PeerWarp?",
      a: "Nowhere. PeerWarp uses WebRTC to establish a direct cryptographic bridge between your browser and the recipient's browser. Files stream memory-to-memory and are never uploaded to any cloud server or staged on third-party disks.",
    },
    {
      q: "Is there a file size limit on PeerWarp?",
      a: "No. PeerWarp is 100% free with no file size limits. Because files are never stored on servers, there are no artificial 2 GB or 5 GB caps. You can stream 500 MB video clips or 50 GB project archives directly.",
    },
    {
      q: "Do I or the receiver need an account or app?",
      a: "No account, app, or email is required. PeerWarp runs directly inside any modern web browser on desktop and mobile, including Chrome, Safari, Firefox, Edge, iOS Safari, and Android Chrome.",
    },
    {
      q: "How fast is direct P2P file transfer?",
      a: "If both devices are on the same Wi-Fi or router, files transfer locally at maximum hardware network speed (50 to 100+ MB/s) consuming zero internet bandwidth. Over the internet, it utilizes your full peer-to-peer connection speed without cloud throttling.",
    },
    {
      q: "Can anyone else intercept or view my files?",
      a: "No. The direct peer-to-peer data channel is encrypted end-to-end using DTLS 1.3 and SCTP cryptography. Once the transfer completes, the receiver's browser verifies the cryptographic SHA-256 hash to guarantee bit-for-bit file integrity.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-16 text-neutral-900 dark:text-neutral-100">
      {/* Hero Section & GEO Definitional Statement */}
      <section className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
          <span>Zero Cloud Storage • Direct Device-to-Device</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Direct P2P File Transfer. <br className="hidden sm:inline" />
          No Cloud Storage. Zero Limits.
        </h1>

        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl mx-auto">
          PeerWarp streams videos, archives, and folders directly from your browser to another device using WebRTC.
          No cloud storage, no registration, and 100% free forever.
        </p>
      </section>

      {/* Main Mode Switcher (Send / Receive / Radar) */}
      {!roomId && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center gap-1 text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab("send")}
              className={`px-5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "send"
                  ? "bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-semibold"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              }`}
            >
              Send Files
            </button>
            <button
              onClick={() => setActiveTab("receive")}
              className={`px-5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "receive"
                  ? "bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-semibold"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              }`}
            >
              Receive Files
            </button>
            <button
              onClick={() => setActiveTab("radar")}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "radar"
                  ? "bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-semibold"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Wi-Fi Radar</span>
            </button>
          </div>

          {canInstallPwa && (
            <button
              type="button"
              onClick={async () => {
                const accepted = await promptPwaInstall();
                if (accepted) setCanInstallPwa(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}
        </div>
      )}

      {/* Main Interaction Canvas */}
      <div className="space-y-6">
        {/* SEND TAB */}
        {activeTab === "send" && !roomId && (
          <div className="space-y-6">
            <DropZone
              onFilesSelected={(newFiles) => {
                setSizeLimitWarning(null);
                const valid: File[] = [];
                const oversized: string[] = [];
                for (const f of newFiles) {
                  if (f.size > MAX_FILE_SIZE_BYTES) {
                    oversized.push(f.name);
                  } else {
                    valid.push(f);
                  }
                }
                if (oversized.length > 0) {
                  setSizeLimitWarning(
                    `"${oversized.join('", "')}" exceeds the 5 GB limit for the free web version. (Self-host PeerWarp for unlimited file sizes).`
                  );
                }
                if (valid.length > 0) {
                  setSelectedFiles((prev) => [...prev, ...valid]);
                }
              }}
            />

            {sizeLimitWarning && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sizeLimitWarning}</span>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="space-y-5">
                <FileQueue
                  files={selectedFiles}
                  onRemoveFile={(idx) =>
                    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                  onClearAll={() => setSelectedFiles([])}
                />

                {/* Group Sharing & Security Settings */}
                <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        <Users className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                        <span>Maximum Allowed Recipients</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        How many colleagues can download simultaneously with this link.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => setMaxRecipients((prev) => Math.max(1, prev - 1))}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors"
                          title="Decrease"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          {maxRecipients}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMaxRecipients((prev) => Math.min(20, prev + 1))}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300 transition-colors"
                          title="Increase"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex items-center gap-1">
                        {[1, 3, 5, 10].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setMaxRecipients(preset)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                              maxRecipients === preset
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Knock Gate Checkbox */}
                  <label className="flex items-start gap-2.5 pt-3 border-t border-neutral-200/80 dark:border-neutral-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)}
                      className="mt-0.5 rounded border-neutral-300 dark:border-neutral-700 text-black focus:ring-black accent-black dark:accent-white"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Knock-to-Join Gate (Human Verification)</span>
                      </span>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Shows an instant popup asking you to Accept/Decline whenever an unfamiliar device attempts to join.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => handleStartSending()}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-semibold text-sm sm:text-base shadow-xs hover:shadow transition-all scale-100 hover:scale-[1.01] active:scale-[0.99]"
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
            {/* Interactive Knock-to-Join Modal */}
            <KnockApprovalModal
              knock={pendingKnock}
              onApprove={handleApproveKnock}
              onReject={handleRejectKnock}
            />

            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Active Streaming Room
              </span>
              <button
                onClick={handleResetSession}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
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
              maxPeers={maxRecipients}
            />

            {/* Live Connected Recipients List */}
            <ConnectedPeersList
              peers={connectedPeers}
              maxPeers={maxRecipients}
              onDisconnectPeer={handleDisconnectPeer}
            />

            {/* Active Transfer Cards */}
            {transferItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
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
          <div className="max-w-md mx-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-xs space-y-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Enter Room Code
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Type the 6-character code shown on the sender screen.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. WARP-482"
                maxLength={8}
                className="w-full text-center text-xl font-mono uppercase tracking-widest px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
              />

              <button
                type="submit"
                disabled={!joinCodeInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-semibold text-sm shadow-xs transition-colors disabled:opacity-50"
              >
                <span>Connect & Download</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* LOCAL RADAR TAB (AirDrop Style) */}
        {activeTab === "radar" && !roomId && (
          <LocalRadar
            selectedFiles={selectedFiles}
            onFilesSelected={(files) => setSelectedFiles(files)}
            hasFilesToSend={selectedFiles.length > 0}
            onSendToPeer={async (targetPeerId, targetDeviceInfo, files, rId, sKey) => {
              await handleStartSending(files, {
                autoApprove: true,
                roomId: rId,
                secretKey: sKey,
              });
            }}
            incomingInvite={radarInvite}
            onAcceptInvite={(invRoomId, invKey) => {
              window.location.href = `/${invRoomId}#k=${invKey}`;
            }}
            onDeclineInvite={() => setRadarInvite(null)}
          />
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: HOW IT WORKS FOR NORMAL USERS                  */}
      {/* ========================================================= */}
      <section id="how-it-works" className="pt-8 border-t border-neutral-200 dark:border-neutral-800 space-y-10">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Simple & Transparent
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            How PeerWarp Works in 3 Steps
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            No software installation or registration. Transfer directly from your laptop to a phone or friend in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <UploadCloud className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Select Your Files
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Drag and drop your photos, 4K videos, zip archives, or documents. Add as many files as you want with no size caps.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
              <span>Never uploaded to any server</span>
            </div>
          </article>

          {/* Step 2 */}
          <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <QrCode className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Share Link or QR Code
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                PeerWarp generates a one-time QR code and a 6-character room code. Scan it with a phone camera or send the direct link.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
              <span>Instant pairing across iOS, Android, PC & Mac</span>
            </div>
          </article>

          {/* Step 3 */}
          <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <Zap className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Direct Memory Streaming
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Data streams straight from browser memory to browser memory. The receiver saves the file directly upon completion.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
              <span>Encrypted with SHA-256 verification</span>
            </div>
          </article>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: WHY PEERWARP VS TRADITIONAL CLOUD              */}
      {/* ========================================================= */}
      <section id="why-peerwarp" className="space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Comparison
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Why Choose PeerWarp?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Compare direct peer-to-peer streaming with traditional cloud upload platforms.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60">
                  <th className="p-4 sm:p-5 font-semibold text-neutral-900 dark:text-neutral-100">Feature</th>
                  <th className="p-4 sm:p-5 font-semibold text-neutral-900 dark:text-neutral-100">PeerWarp (P2P)</th>
                  <th className="p-4 sm:p-5 font-medium text-neutral-500 dark:text-neutral-400">WeTransfer / Google Drive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">File Storage</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Zero cloud storage (in-memory only)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Stored on 3rd-party servers for days</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">File Size Limits</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium">
                    Unlimited (1 GB, 20 GB, 50 GB+)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Capped at 2 GB unless you pay a monthly fee</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Transfer Flow</td>
                  <td className="p-4 sm:p-5 text-neutral-900 dark:text-neutral-200">
                    Direct stream: receiver downloads immediately
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Must upload 100% first, then receiver downloads</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Local Wi-Fi Speed</td>
                  <td className="p-4 sm:p-5 text-neutral-900 dark:text-neutral-200">
                    Gigabit LAN speed (50–100 MB/s, 0 quota used)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Limited by your home/office upload bandwidth</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Privacy & Security</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium">
                    End-to-End DTLS 1.3 encryption + SHA-256
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Server holds decryption keys & logs IP</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Price & Sign-up</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium">
                    100% Free, no account, no email needed
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Requires registration or paid plan</td>
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
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Clear Answers
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Common questions about safety, privacy, and how PeerWarp transfers files.
          </p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-2xs transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-black dark:text-white" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-neutral-800">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer / Trust Guarantee */}
      <footer className="pt-12 border-t border-neutral-200 dark:border-neutral-800 text-center space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Zero Data Stored
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            DTLS 1.3 / SCTP Encrypted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            64KB Micro-Chunking
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            100% Free Open Source
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          PeerWarp is an open-source peer-to-peer file streaming web application. No files, logs, or analytics cookies are collected.
        </p>
      </footer>
    </div>
  );
}
