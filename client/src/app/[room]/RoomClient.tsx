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
  Archive,
  Folder,
  Download,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import { TransferCard } from "@/components/TransferCard";
import { SignalingClient } from "@/lib/signaling";
import { WebRTCPeer } from "@/lib/webrtc";
import { FileStreamReceiver } from "@/lib/streamer";
import { FileTransferItem, FileMetadataPacket, FileCompletePacket } from "@/types/protocol";
import { wakeLock } from "@/lib/wakelock";
import { supportsFileSystemAccess, createDirectFileWriter } from "@/lib/filesystem";
import { createZipArchive, downloadBlob, ZipFileEntry } from "@/lib/zip";
import { formatBytes } from "@/lib/crypto";

interface RoomClientProps {
  initialRoom: string;
}

export default function RoomClient({ initialRoom }: RoomClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [manualCodeInput, setManualCodeInput] = useState("");

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "waiting_for_approval" | "waiting_for_sender" | "connected" | "transferring" | "completed" | "error"
  >("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ type: string; label: string; isLocal: boolean } | null>(null);
  const [activeItem, setActiveItem] = useState<FileTransferItem | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<FileTransferItem[]>([]);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const receiverStreamerRef = useRef<FileStreamReceiver>(new FileStreamReceiver());

  useEffect(() => {
    setIsMounted(true);
    let r = initialRoom;
    if (typeof window !== "undefined") {
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0 && pathParts[0].toUpperCase() !== "CONNECT") {
        r = pathParts[0].toUpperCase();
      }
    }
    setRoomId(r);
  }, [initialRoom]);

  useEffect(() => {
    if (!isMounted || !roomId || roomId === "CONNECT") return;

    let isActive = true;

    async function initReceiver() {
      try {
        setConnectionStatus("connecting");
        setErrorMessage(null);

        // 1. Initialize Signaling Client
        const signaling = new SignalingClient(roomId, (envelope) => {
          if (!isActive) return;

          if (envelope.type === "error") {
            setConnectionStatus("error");
            setErrorMessage(envelope.message || "Failed to join room.");
            return;
          }

          if (envelope.type === "joined") {
            if (envelope.requireApproval && !envelope.approved) {
              setConnectionStatus("waiting_for_approval");
            } else {
              setConnectionStatus("connected");
            }
            return;
          }

          if (envelope.type === "peer_approved") {
            setConnectionStatus("connected");
            return;
          }

          if (envelope.type === "peer_rejected") {
            setConnectionStatus("error");
            setErrorMessage(envelope.message || "Transfer request was declined by the host.");
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
              setConnectionStatus((prev) => (prev === "transferring" ? "transferring" : "connected"));
              setErrorMessage(null);
              setTimeout(async () => {
                if (peerRef.current) {
                  const r = await peerRef.current.getActiveRoute();
                  setRouteInfo(r);
                }
              }, 600);
            } else if (state === "disconnected") {
              console.log("[Receiver WebRTC] Interruption detected. Waiting for connection recovery...");
              setErrorMessage("Connection interrupted temporarily. Resuming transfer once connected...");
            } else if (state === "failed") {
              setConnectionStatus("error");
              setErrorMessage("P2P direct connection lost.");
            }
          },
          onDataChannelReady: (channel) => {
            console.log("[Receiver DataChannel] Ready!");
            setConnectionStatus((prev) => (prev === "transferring" ? "transferring" : "connected"));
            setErrorMessage(null);
            setupDataChannelListeners(channel);
            setTimeout(async () => {
              if (peerRef.current) {
                const r = await peerRef.current.getActiveRoute();
                setRouteInfo(r);
              }
            }, 600);
          },
          onError: (err) => {
            console.error("[Receiver WebRTC] Error:", err);
            wakeLock.release();
            setConnectionStatus("error");
            setErrorMessage(err);
          },
        });
        peerRef.current = peer;
        await peer.initialize();
      } catch (err: any) {
        console.error("Failed to connect receiver:", err);
        wakeLock.release();
        if (isActive) {
          setConnectionStatus("error");
          setErrorMessage(err?.message || "Could not connect to signaling server.");
        }
      }
    }

    initReceiver();

    return () => {
      isActive = false;
      wakeLock.release();
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
            const resumeBytes = await receiverStreamerRef.current.handleMetadata(meta, channel);

            // Direct-to-Disk streaming for files > 200 MB on supported browsers (zero RAM usage)
            if (meta.size > 200 * 1024 * 1024 && supportsFileSystemAccess()) {
              try {
                const writer = await createDirectFileWriter(meta.name);
                if (writer) {
                  receiverStreamerRef.current.setDirectWriter(writer);
                }
              } catch (_) {}
            }

            // Prevent mobile screen sleep while receiving
            wakeLock.request();

            const initialProgress = resumeBytes > 0 ? Math.min(100, Math.round((resumeBytes / meta.size) * 100)) : 0;

            setActiveItem({
              id: meta.id,
              name: meta.name,
              relativePath: meta.relativePath || meta.name,
              size: meta.size,
              type: meta.type,
              progress: initialProgress,
              speedBps: 0,
              etaSeconds: 0,
              status: "receiving",
              resumedFromBytes: resumeBytes > 0 ? resumeBytes : undefined,
            });
            setConnectionStatus("transferring");
          } else if (packet.cmd === "RESUME_ACK") {
            console.log(`[RoomClient] Sender acknowledged resume offset: ${packet.startOffset}`);
            setActiveItem((prev) => (prev ? { ...prev, resumedFromBytes: packet.startOffset } : null));
          } else if (packet.cmd === "FILE_COMPLETE") {
            const complete = packet as FileCompletePacket;
            setActiveItem((prev) => (prev ? { ...prev, status: "verifying" } : null));

            // Finalize received blob or direct disk writer and verify SHA-256
            const result = await receiverStreamerRef.current.finalize(complete.sha256);
            let downloadUrl = "";
            if (!result.isDirectSaved && result.blob && result.blob.size > 0) {
              downloadUrl = URL.createObjectURL(result.blob);
            }

            // Release wake lock
            wakeLock.release();

            const completedItem: FileTransferItem = {
              id: activeItem?.id || complete.id,
              name: activeItem?.name || "file",
              relativePath: activeItem?.relativePath || activeItem?.name || "file",
              size: activeItem?.size || 0,
              type: activeItem?.type || "application/octet-stream",
              progress: 100,
              speedBps: 0,
              etaSeconds: 0,
              status: "completed",
              sha256: result.actualSha256,
              blobUrl: downloadUrl,
              isDirectSaved: result.isDirectSaved,
            };

            setActiveItem(completedItem);
            setReceivedFiles((prev) => [...prev.filter((f) => f.id !== completedItem.id), completedItem]);
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
        await receiverStreamerRef.current.handleChunk(event.data, (update) => {
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

  const handleDownloadAllZip = async () => {
    setIsZipping(true);
    try {
      const entries: ZipFileEntry[] = [];
      for (const item of receivedFiles) {
        if (item.blobUrl) {
          const res = await fetch(item.blobUrl);
          const buf = await res.arrayBuffer();
          entries.push({
            name: item.relativePath || item.name,
            data: new Uint8Array(buf),
          });
        }
      }

      if (entries.length > 0) {
        const zipBlob = await createZipArchive(entries);
        downloadBlob(zipBlob, `PeerWarp-${roomId || "files"}.zip`);
      }
    } catch (err) {
      console.error("Failed to generate zip:", err);
    } finally {
      setIsZipping(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8 text-neutral-900 dark:text-neutral-100">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to PeerWarp</span>
          </Link>
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center space-y-4 shadow-xs">
          <Loader2 className="w-9 h-9 text-neutral-500 dark:text-neutral-400 animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Initializing PeerWarp Connection...
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Establishing encrypted peer-to-peer bridge. Please keep this tab open.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasFolderStructure = receivedFiles.some((f) => f.relativePath && f.relativePath.includes("/"));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8 text-neutral-900 dark:text-neutral-100">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to PeerWarp</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500">
            Room Code
          </span>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700">
            {roomId || "CONNECT"}
          </span>
        </div>
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

      {/* Main Status Canvas */}
      <div className="space-y-6">
        {/* Manual Code Input if landed on /connect */}
        {(!roomId || roomId === "CONNECT") && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center space-y-6 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Receive Files via Room Code
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Enter the room code (e.g. WARP-4X7K) provided by the sender.
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
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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

        {/* Waiting for Host Approval Card (Knock-to-Join) */}
        {roomId && roomId !== "CONNECT" && connectionStatus === "waiting_for_approval" && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 p-10 sm:p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-300/80 dark:border-amber-700/60 flex items-center justify-center mx-auto animate-pulse">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Waiting for Host Approval...
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
                Your device is knocking on the room door. The sender has been prompted on their screen to approve your connection. Transfer will start automatically once approved.
              </p>
            </div>
          </div>
        )}

        {/* Connecting Spinner */}
        {roomId && roomId !== "CONNECT" && connectionStatus === "connecting" && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center space-y-4 shadow-xs">
            <Loader2 className="w-9 h-9 text-neutral-500 dark:text-neutral-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Connecting to Room {roomId}...
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Establishing direct encrypted peer-to-peer bridge. Please keep this tab open.
              </p>
            </div>
          </div>
        )}

        {/* Connected - Waiting for sender to stream */}
        {connectionStatus === "connected" && !activeItem && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Connected Directly to Sender
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
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

        {/* Multi-File / Folder Archive Card */}
        {receivedFiles.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                {hasFolderStructure ? (
                  <Folder className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                ) : (
                  <Archive className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                )}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Received Files ({receivedFiles.length})
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    {hasFolderStructure
                      ? "Folder tree preserved • Download all as ZIP archive"
                      : "Directly received via WebRTC DataChannel"}
                  </p>
                </div>
              </div>

              {/* Download All as ZIP button */}
              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isZipping}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {isZipping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>Download All as .ZIP</span>
              </button>
            </div>

            {/* List of received files */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-56 overflow-y-auto">
              {receivedFiles.map((f) => (
                <div
                  key={f.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {f.relativePath || f.name}
                    </p>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {formatBytes(f.size)} • SHA-256 Verified
                    </span>
                  </div>

                  {f.blobUrl && (
                    <a
                      href={f.blobUrl}
                      download={f.name}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium shrink-0 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Save
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {connectionStatus === "error" && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center space-y-4 shadow-xs">
            <AlertCircle className="w-9 h-9 text-neutral-500 dark:text-neutral-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Session Notice
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
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
