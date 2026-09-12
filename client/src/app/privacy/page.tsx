import { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Lock, EyeOff, ServerOff, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Zero-Knowledge & Zero-Storage Architecture",
  description:
    "PeerWarp's Privacy Policy. Learn about our strict Zero-Cloud-Storage and Zero-Knowledge P2P architecture. Your files are never stored, logged, or inspected.",
  alternates: {
    canonical: "https://peerwarp.com/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 selection:bg-indigo-500/20 selection:text-indigo-600 dark:selection:text-indigo-400">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to PeerWarp</span>
          </Link>
        </div>

        {/* Title Header */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Guarantee</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-base leading-relaxed">
            Effective Date: September 12, 2026 • Engineered & Maintained by{" "}
            <a
              href="https://ahmedalgendy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              Ahmed Algendy
            </a>
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
            <ServerOff className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-3" />
            <h3 className="font-semibold text-sm mb-1">Zero Server Storage</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Files are streamed directly between browsers in memory. No bytes ever touch a disk or cloud bucket.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
            <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-3" />
            <h3 className="font-semibold text-sm mb-1">End-to-End Encrypted</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Transfers use DTLS 1.3 cryptographic channels with ephemeral zero-knowledge keys in the URL hash.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
            <EyeOff className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-3" />
            <h3 className="font-semibold text-sm mb-1">No Activity Logging</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              We do not track file names, metadata, user identities, or retain transfer history logs.
            </p>
          </div>
        </div>

        {/* Policy Content Sections */}
        <div className="space-y-10 text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              1. Fundamental Architecture & Zero-Knowledge Commitment
            </h2>
            <p className="mb-3">
              PeerWarp is architected from the ground up as a pure <strong>Peer-to-Peer (P2P) direct transfer service</strong>. Unlike legacy cloud services (such as Dropbox, WeTransfer, or Google Drive) that require you to upload files to an intermediate cloud server before downloading, PeerWarp establishes a direct, encrypted browser-to-browser WebRTC connection.
            </p>
            <p>
              Under this architecture, <strong>PeerWarp never stores, caches, retains, or hosts your files</strong>. When you transfer a file, the binary data streams directly from your device’s memory or local storage directly to the recipient’s browser. Once the transfer completes or the browser tab closes, the data ceases to exist within the application session.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              2. Information We Do NOT Collect
            </h2>
            <p className="mb-2">We firmly adhere to the principle of data minimization. We do NOT collect:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-600 dark:text-neutral-400">
              <li><strong>File Contents & Payloads:</strong> Your files remain 100% inaccessible to us.</li>
              <li><strong>File Names & Metadata:</strong> File titles, sizes, MIME types, and folder structures are exchanged exclusively between peer browsers over encrypted signaling.</li>
              <li><strong>Personal Identities & Accounts:</strong> No user registration, email address, password, or account is ever required.</li>
              <li><strong>Tracking Cookies & Behavioral Profiling:</strong> We do not use advertising cookies, cross-site tracking, or commercial telemetry beacons.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              3. Transient Data Handled During Operation
            </h2>
            <p className="mb-3">
              To coordinate direct P2P connections and protect against network abuse, minimal technical data is handled transiently:
            </p>
            <div className="space-y-3 pl-4 border-l-2 border-indigo-500/30">
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                  A. Ephemeral WebRTC Signaling (Cloudflare Durable Objects)
                </h4>
                <p className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">
                  To connect two peers, our signaling worker passes ephemeral WebRTC connection metadata (SDP offers/answers and ICE candidate IP addresses). This data lives solely in volatile server RAM and is permanently erased the instant peers disconnect or the room closes.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                  B. Volatile Rate-Limiting IP Memory Maps
                </h4>
                <p className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">
                  To protect public infrastructure against DDoS attacks and proxy hijacking, client IP addresses are evaluated against short-lived, in-memory counters (e.g., max 10 TURN sessions/hour). These counters are stored in volatile edge memory and automatically expire every 60 minutes. They are never written to databases or linked to user identities.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                  C. Local Browser Storage (IndexedDB Checkpoints)
                </h4>
                <p className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">
                  To enable seamless resumption of interrupted transfers, partial chunks are stored exclusively in your browser’s local IndexedDB on your physical machine. No checkpoint data is ever synchronized to our servers.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              4. Cryptographic Security & Zero-Knowledge URL Secrets
            </h2>
            <p className="mb-3">
              PeerWarp utilizes a <strong>Zero-Knowledge URL Hash Secret</strong> (`#k=...`). When you generate a transfer link, a 128-bit cryptographic key is stored strictly within the URL fragment (the portion after `#`).
            </p>
            <p className="text-neutral-600 dark:text-neutral-400 text-xs">
              According to the W3C HTTP specification, URL fragments are never sent to web servers or proxies in HTTP request headers or WebSocket handshakes. This guarantees that only someone in possession of the full share link can access the room and negotiate peer encryption keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              5. Third-Party Infrastructure Providers
            </h2>
            <p className="mb-2">PeerWarp relies on reputable, enterprise-grade cloud providers for real-time routing:</p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-600 dark:text-neutral-400 text-xs">
              <li><strong>Cloudflare, Inc.:</strong> Hosts our static web assets, Edge Worker routing, and Turnstile bot protection.</li>
              <li><strong>Hetzner Online GmbH:</strong> Hosts our dedicated Coturn STUN/TURN relay server used for NAT traversal when direct P2P connections cannot be established. Relay traffic is encrypted via DTLS/SRTP and relayed in real time without recording.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              6. Contact & Legal Inquiries
            </h2>
            <p>
              For privacy-related questions, technical inquiries, or open-source audits, you may contact the architecture lead:
            </p>
            <div className="mt-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">Ahmed Algendy</p>
              <p className="text-neutral-600 dark:text-neutral-400">Lead Architect & Maintainer, PeerWarp</p>
              <p className="text-neutral-600 dark:text-neutral-400">Website: <a href="https://ahmedalgendy.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">ahmedalgendy.com</a></p>
              <p className="text-neutral-600 dark:text-neutral-400">Email: <a href="mailto:contact@ahmedalgendy.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">contact@ahmedalgendy.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
