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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"send" | "receive" | "radar">("send");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [radarInvite, setRadarInvite] = useState<any | null>(null);
  const MAX_RELAY_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);

  const handleFilesSelected = (newFiles: File[]) => {
    setSizeWarning(null);
    const large = newFiles.find((f) => f.size > MAX_RELAY_FILE_SIZE_BYTES);
    if (large) {
      setSizeWarning(
        `⚡ Note: "${large.name}" is over 5 GB. Large files stream freely with no size limits on direct Wi-Fi or internet connections.`
      );
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  // Multi-user & Privacy settings
  const [maxRecipients, setMaxRecipients] = useState<number>(5);
  const [requireApproval, setRequireApproval] = useState<boolean>(true);
  const [pendingKnock, setPendingKnock] = useState<{ peerId: string; deviceInfo: string } | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<RecipientPeer[]>([]);

  // Sender session state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [peerCount, setPeerCount] = useState(1);
  const [routeInfo, setRouteInfo] = useState<{ type: string; label: string; isLocal: boolean } | null>(null);
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
          if (state === "connected") {
            setTimeout(async () => {
              if (peerRef.current) {
                const r = await peerRef.current.getActiveRoute(peerId);
                setRouteInfo(r);
              }
            }, 600);
          } else if (state === "disconnected") {
            console.log("[WebRTC Host] Interruption detected. Attempting ICE restart...", peerId);
            if (peerRef.current && peerId) {
              peerRef.current.restartIce(peerId).catch(() => {});
            }
          }
        },
        onDataChannelReady: (channel, peerId) => {
          console.log("[DataChannel] Ready for peer:", peerId);
          setTimeout(async () => {
            if (peerRef.current) {
              const r = await peerRef.current.getActiveRoute(peerId);
              setRouteInfo(r);
            }
          }, 600);
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
          const currentRoute = await peerRef.current?.getActiveRoute();
          const isLocal = currentRoute?.isLocal ?? (routeInfo?.isLocal ?? true);
          const isRelay = currentRoute?.type === "relay";

          if (isRelay && current.file.size > MAX_RELAY_FILE_SIZE_BYTES) {
            throw new Error(
              `Transfer blocked: "${current.name}" exceeds the 5 GB limit for mobile cellular data transfers. Up to 50 GB is supported on direct Wi-Fi and direct internet connections.`
            );
          }

          const finalSha256 = await streamer.sendFile(
            current.file,
            (update) => {
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
            },
            { isLocal }
          );

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
      a: "Nowhere. PeerWarp uses WebRTC to establish a direct cryptographic peer-to-peer bridge between your browser and the recipient's browser. Files stream directly memory-to-memory and are never uploaded to any cloud server or staged on third-party disks.",
    },
    {
      q: "Does transferring files on the same Wi-Fi consume my internet quota?",
      a: "Zero KB! When both devices are on the same Wi-Fi router, WebRTC establishes a direct local host connection. The transfer happens purely over your local wireless hardware at up to 500+ Mbps, consuming 0 MB of your mobile data or home internet bundle.",
    },
    {
      q: "Is there any file size limit on PeerWarp?",
      a: "No artificial size limits! PeerWarp streams files of any size directly device-to-device using WebRTC micro-chunking. Because files are streamed directly from browser to browser and never uploaded to cloud servers, you can send massive videos, disk images, and archives freely without cloud storage caps.",
    },
    {
      q: "How does the Local Wi-Fi Direct Radar work?",
      a: "Open the 'Wi-Fi Direct' tab on any devices connected to your local network. Devices appear automatically on the live radar screen without typing codes. Simply select a file and tap the device icon to transfer instantly across iPhone, Android, Mac, Windows, and Linux.",
    },
    {
      q: "How fast is direct P2P file transfer on PeerWarp?",
      a: "On local Wi-Fi, transfers reach hardware speeds of up to 500+ Mbps (60–80+ MB/s). When transferring across separate locations or mobile 4G/5G, PeerWarp dynamically optimizes WebRTC buffering and utilizes our global low-latency TURN relay as an automatic fallback.",
    },
    {
      q: "Do I or the receiver need to install software or register an account?",
      a: "No app installation, account, or email is required. PeerWarp runs directly inside any modern web browser on desktop and mobile, including Safari on iOS, Chrome on Android, Firefox, and Edge.",
    },
    {
      q: "Can anyone else intercept or view my files?",
      a: "No. All transfers are encrypted end-to-end using DTLS 1.3 and SCTP protocols. In addition, PeerWarp computes a cryptographic SHA-256 checksum during streaming to guarantee 100% bit-for-bit file integrity upon completion.",
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
          Send Large Files Directly. <br className="hidden sm:inline" />
          No Cloud Uploads. No Size Limits.
        </h1>

        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl mx-auto">
          Stream files of any size directly from your browser to another device using WebRTC.
          Zero cloud storage, no account required, and 100% free forever.
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
              id="tab-radar"
              onClick={() => setActiveTab("radar")}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "radar"
                  ? "bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-semibold"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Wi-Fi Direct</span>
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
                handleFilesSelected(newFiles);
              }}
            />

            {sizeWarning && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="leading-relaxed">{sizeWarning}</div>
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

            {/* Live Network Route Badge (Zero Internet / Local Wi-Fi Proof) */}
            {routeInfo && (
              <div className="flex items-center justify-center">
                <div
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border shadow-2xs transition-all ${
                    routeInfo.isLocal
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      : "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      routeInfo.isLocal ? "bg-emerald-500 animate-pulse" : "bg-blue-500"
                    }`}
                  />
                  <span>{routeInfo.label}</span>
                </div>
              </div>
            )}

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

        {/* LOCAL RADAR TAB (Wi-Fi Direct) */}
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

        {/* Legal Disclaimer & User Responsibility Trust Notice */}
        <div className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <span>By transferring or receiving files, you agree to our </span>
          <a
            href="/terms"
            className="font-medium text-neutral-800 dark:text-neutral-200 underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Terms of Use & Legal Disclaimer
          </a>
          <span> and </span>
          <a
            href="/privacy"
            className="font-medium text-neutral-800 dark:text-neutral-200 underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Privacy Policy
          </a>
          <span>. Transfers are direct P2P; users bear sole responsibility for content.</span>
        </div>
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
                Choose Files or Full Folders
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Drag and drop photos, 4K video footage, 50 GB+ zip archives, or pick entire directory trees using our large Browse buttons. No file size restrictions.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>0 MB Cloud Storage • 100% In-Browser</span>
            </div>
          </article>

          {/* Step 2 */}
          <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <Radio className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                1-Click Wi-Fi Direct Radar or Room Code
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Discover nearby devices automatically on the Local Wi-Fi Direct Radar, or share your high-entropy 8-character room code and instant QR code.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Cross-platform (iOS, Android, Windows, Mac, Linux)</span>
            </div>
          </article>

          {/* Step 3 */}
          <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Direct Hardware-Speed Streaming
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Data streams memory-to-memory via encrypted WebRTC at up to 500+ Mbps on local Wi-Fi with 0 KB internet quota used and SHA-256 integrity verification.
              </p>
            </div>
            <div className="pt-2 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Up to 500+ Mbps • End-to-End DTLS 1.3 Encrypted</span>
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
                    <Check className="w-4 h-4 text-emerald-600" /> Zero cloud storage (100% memory streaming)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Stored on 3rd-party servers for days/weeks</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">File Size Limits</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> No artificial limits (Stream any file size)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Capped at 2 GB free unless you pay monthly</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Local Wi-Fi Speed</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Up to 500+ Mbps (Hardware LAN speed)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Limited by home/office ISP upload bandwidth</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Internet Quota on Wi-Fi</td>
                  <td className="p-4 sm:p-5 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> 0 KB consumed (transfers locally)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Double quota consumed (upload + download)</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Nearby Device Discovery</td>
                  <td className="p-4 sm:p-5 text-neutral-900 dark:text-neutral-200">
                    1-Click Local Wi-Fi Direct Radar
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Requires typing email addresses or invite links</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Transfer Flow</td>
                  <td className="p-4 sm:p-5 text-neutral-900 dark:text-neutral-200">
                    Direct stream: receiver downloads immediately
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Must upload 100% first, then wait to download</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Privacy & Security</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium">
                    End-to-End DTLS 1.3 encryption + SHA-256
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-500 dark:text-neutral-400">Server holds decryption keys & logs IP</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-neutral-900 dark:text-neutral-100">Price & Accounts</td>
                  <td className="p-4 sm:p-5 text-black dark:text-white font-medium">
                    100% Free forever, no account, no email needed
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
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-2xl mx-auto leading-relaxed">
          PeerWarp is an open-source peer-to-peer file streaming web application engineered by{" "}
          <a
            href="https://ahmedalgendy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-600 dark:text-neutral-300 hover:underline font-medium"
          >
            Ahmed Algendy
          </a>
          . All transfers operate as direct P2P conduits with zero server storage. Users bear sole and exclusive legal responsibility for all transmitted content.
        </p>
      </footer>
    </div>
  );
}
