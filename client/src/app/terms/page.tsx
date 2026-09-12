import { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Scale, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Use & Legal Disclaimer — User Responsibilities & Conduit Terms",
  description:
    "PeerWarp's Terms of Use, User Responsibility Agreement, and Legal Liability Disclaimers. PeerWarp operates strictly as a zero-knowledge P2P conduit.",
  alternates: {
    canonical: "https://peerwarp.com/terms",
  },
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 mb-4">
            <Scale className="w-3.5 h-3.5" />
            <span>Legal Agreement & User Responsibilities</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Terms of Use & Legal Disclaimer
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-base leading-relaxed">
            Last Revised: September 12, 2026 • Engineered & Maintained by{" "}
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

        {/* Essential Legal Summary Banner */}
        <div className="p-6 rounded-2xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 mb-12">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-1" />
            <div className="space-y-2">
              <h2 className="text-base font-bold text-amber-900 dark:text-amber-200">
                Critical Legal Notice & Conduit Status
              </h2>
              <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                PeerWarp is an automated, zero-storage peer-to-peer (P2P) transmission utility.{" "}
                <strong>
                  You, the user, assume 100% sole legal responsibility for all files and content you choose to transmit or receive.
                </strong>{" "}
                PeerWarp and its developer, Ahmed Algendy, hold zero access, control, or visibility over your transfers and expressly disclaim all liability for any misuse, copyright infringement, or unlawful actions conducted by users.
              </p>
            </div>
          </div>
        </div>

        {/* Legal Sections */}
        <div className="space-y-10 text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>1. Acceptance of Terms</span>
            </h2>
            <p className="mb-3">
              By accessing, browsing, or using PeerWarp (accessible at <code>peerwarp.com</code> and related mirrors), you acknowledge that you have read, understood, and irrevocably agree to be bound by these Terms of Use and the accompanying Privacy Policy. If you do not agree with any portion of these terms, you are strictly prohibited from using the application.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>2. Sole Responsibility of the User</span>
            </h2>
            <p className="mb-3">
              PeerWarp provides a direct, unmediated communication pipeline between end-user browsers. As a user, you expressly understand and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600 dark:text-neutral-400">
              <li>
                <strong>Content Ownership & Legitimacy:</strong> You bear sole and exclusive legal liability for the selection, transmission, accuracy, legality, and consequences of any data, software, archives, videos, or documents you transfer.
              </li>
              <li>
                <strong>Intellectual Property & Copyrights:</strong> You warrant that you possess all necessary intellectual property rights, licenses, permissions, or lawful exemptions to send and receive the files you distribute.
              </li>
              <li>
                <strong>Recipient Verification:</strong> You are solely responsible for verifying the identity and trustworthiness of the peer with whom you share room codes or transfer links.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500 dark:text-red-400" />
              <span>3. Strict Acceptable Use Policy (AUP) — Prohibited Misuse</span>
            </h2>
            <p className="mb-3">
              You agree not to use PeerWarp for any purpose that is unlawful, harmful, or prohibited by these terms. Specifically, you agree NOT to transmit, facilitate, or distribute:
            </p>
            <div className="space-y-2.5 p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 text-xs text-neutral-700 dark:text-neutral-300">
              <p>❌ <strong>Child Exploitation:</strong> Any child sexual abuse material (CSAM) or content exploiting minors in any manner.</p>
              <p>❌ <strong>Malicious Software:</strong> Viruses, trojan horses, worms, ransomware, keyloggers, or any payload intended to compromise systems.</p>
              <p>❌ <strong>Copyright Infringement:</strong> Pirated commercial media, cracked software, proprietary databases, or trade secrets without explicit legal authorization.</p>
              <p>❌ <strong>Violence & Terrorism:</strong> Material promoting violent extremism, terrorism, hate speech, or physical harm.</p>
              <p>❌ <strong>Relay & Infrastructure Abuse:</strong> Automated scripts, flood attacks, Denial of Service (DDoS), or attempting to hijack Coturn TURN servers as public open proxies.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              4. Complete Disclaimer of Misuse & Limitation of Liability
            </h2>
            <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs space-y-3 leading-relaxed">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                Comprehensive Liability Waiver:
              </p>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PEERWARP, ITS DEVELOPERS, CREATORS (INCLUDING AHMED ALGENDY), CONTRIBUTORS, AND HOSTING PROVIDERS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES WHATSOEVER.
              </p>
              <p>
                THIS INCLUDES, WITHOUT LIMITATION:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>ANY MISUSE OF THE PLATFORM OR TRANSMISSION OF UNLAWFUL OR INFRINGING CONTENT BY THIRD-PARTY USERS;</li>
                <li>CORRUPTION, INTERRUPTION, LOSS, OR LEAK OF DATA OCCURRING DURING PEER TRANSMISSION;</li>
                <li>CARRIER OR INTERNET SERVICE PROVIDER BANDWIDTH FEES, OVERAGE CHARGES, OR NETWORK THROTTLING;</li>
                <li>HARDWARE DAMAGE, SYSTEM CRASHES, OR OPERATING SYSTEM ERRORS RESULTING FROM LARGE FILE STREAMS;</li>
                <li>ANY UNAUTHORIZED ACCESS RESULTING FROM COMPROMISED ROOM URLS SHARED VOLUNTARILY BY USERS.</li>
              </ul>
              <p>
                PEERWARP IS DISTRIBUTED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              5. Statutory Conduit & Safe Harbor Status
            </h2>
            <p className="mb-2">
              PeerWarp functions exclusively as a <strong>passive, ephemeral, automated technological conduit</strong>. In accordance with safe harbor principles (such as DMCA 17 U.S.C. § 512(a) and equivalent international conduit doctrines):
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-600 dark:text-neutral-400 text-xs">
              <li>Transmissions are initiated by or at the direction of end users, not by PeerWarp.</li>
              <li>Routing, connection establishment, and intermediate relaying take place through automated technical processes without manual selection of material.</li>
              <li>PeerWarp does not select the recipients of materials.</li>
              <li>No copy of transmitted material is maintained on PeerWarp server infrastructure.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              6. Indemnification
            </h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              You agree to defend, indemnify, and hold harmless Ahmed Algendy, PeerWarp contributors, partners, and cloud infrastructure suppliers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or legal fees arising out of or relating to your violation of these Terms or your transmission of content through the application.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              7. Open Source License & Contact
            </h2>
            <p className="mb-3 text-xs">
              The PeerWarp frontend and signaling clients are released under the terms of the <strong>MIT License</strong>.
            </p>
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs">
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
