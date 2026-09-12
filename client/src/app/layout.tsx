import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const siteUrl = "https://peerwarp.com";
const title = "PeerWarp — Free Zero-Cloud-Storage P2P File Transfer";
const description =
  "Stream unlimited files directly device-to-device using WebRTC DataChannels. No cloud storage, no file size limits, end-to-end encrypted, and 100% free forever.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | PeerWarp",
  },
  description,
  keywords: [
    "P2P file transfer",
    "WebRTC file transfer",
    "Wi-Fi Direct file transfer Windows",
    "WeTransfer free alternative",
    "send large files without upload",
    "direct device to device transfer",
    "zero cloud storage transfer",
    "browser to browser streaming",
    "open source file share",
    "end to end encrypted file transfer",
  ],
  authors: [{ name: "Ahmed Algendy", url: "https://ahmedalgendy.com" }],
  creator: "Ahmed Algendy",
  publisher: "PeerWarp Open Source",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "PeerWarp",
    title,
    description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PeerWarp — Zero-Cloud-Storage P2P Direct File Transfer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@AhmedAlgendy",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

// Generative Engine Optimization (GEO) & Schema.org Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://peerwarp.com/#webapp",
      "name": "PeerWarp",
      "url": "https://peerwarp.com",
      "applicationCategory": "FileTransferApplication",
      "operatingSystem": "All (Chrome, Safari, Firefox, Edge, iOS, Android)",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "description":
        "PeerWarp is an open-source peer-to-peer (P2P) direct file streaming web application. Files stream directly between web browsers using WebRTC DataChannels with zero intermediate cloud storage.",
      "featureList": [
        "Zero cloud storage (100% in-memory streaming)",
        "No artificial file size limits (supports 50GB+)",
        "End-to-end encryption via DTLS 1.3 and SCTP",
        "Cryptographic SHA-256 integrity verification",
        "Instant one-touch mobile pairing with QR code and 6-character room codes",
        "Local Wi-Fi gigabit LAN acceleration up to 100 MB/s",
      ],
      "author": {
        "@type": "Person",
        "name": "Ahmed Algendy",
        "url": "https://ahmedalgendy.com",
      },
    },
    {
      "@type": "HowTo",
      "@id": "https://peerwarp.com/#howto",
      "name": "How to Transfer Large Files Directly with PeerWarp",
      "description":
        "Step-by-step instructions to transfer files of any size directly device-to-device with zero cloud storage.",
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Select or Drop Files",
          "text": "Drag and drop any 4K video, archive, raw photos, or documents of any size into PeerWarp.",
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Share Room Code or QR Code",
          "text": "Scan the generated QR code with your mobile camera or copy and send the 6-character room code.",
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Direct Peer-to-Peer Stream",
          "text": "Data streams memory-to-memory across WebRTC DataChannels directly to the recipient's device.",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://peerwarp.com/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Where do my files get uploaded on PeerWarp?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Nowhere. PeerWarp uses WebRTC DataChannels to establish a direct cryptographic bridge between your browser and the recipient. Files stream memory-to-memory and never touch any cloud storage server.",
          },
        },
        {
          "@type": "Question",
          "name": "Is there a file size limit on PeerWarp?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. PeerWarp has no file size limits because data is never stored on servers. You can send 500 MB clips or 50 GB archives completely free.",
          },
        },
        {
          "@type": "Question",
          "name": "Do I need an account or app to use PeerWarp?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No account, app, or plugin is required. PeerWarp runs directly inside any modern web browser on desktop and mobile.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 antialiased">
        <Navbar />

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8 bg-neutral-50 dark:bg-neutral-950 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">PeerWarp</span>
              <span>•</span>
              <a
                href="/privacy"
                className="hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline transition-colors"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a
                href="/terms"
                className="hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline transition-colors"
              >
                Terms of Use & Legal Disclaimer
              </a>
              <span>•</span>
              <span>MIT License</span>
            </div>

            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <span>Engineered by</span>
              <a
                href="https://ahmedalgendy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-black dark:text-white hover:underline"
              >
                Ahmed Algendy
              </a>
            </div>
          </div>
        </footer>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
