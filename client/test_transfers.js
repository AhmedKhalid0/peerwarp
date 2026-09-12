const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "https://peerwarp.com";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Generate a dummy test binary file (1.5 MB)
function createSampleFile(sizeMB = 1.5) {
  const sizeBytes = Math.round(sizeMB * 1024 * 1024);
  const filePath = path.join(__dirname, `test_sample_${Date.now()}.bin`);
  const buf = Buffer.alloc(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) {
    buf[i] = (i * 31) % 256;
  }
  fs.writeFileSync(filePath, buf);
  return filePath;
}

async function runScenario(scenarioName, forceRelayOnReceiver = false) {
  console.log(`\n======================================================================`);
  console.log(`🚀 STARTING TEST: ${scenarioName}`);
  console.log(`📡 Mode: ${forceRelayOnReceiver ? "4G / Cellular (Forced TURN Relay via Hetzner)" : "Wi-Fi / LAN Direct P2P (Direct Host & STUN)"}`);
  console.log(`======================================================================`);

  const tempFilePath = createSampleFile(1.2); // 1.2 MB test file
  const testFileSize = fs.statSync(tempFilePath).size;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
    ],
  });

  try {
    const senderContext = await browser.createBrowserContext();
    const receiverContext = await browser.createBrowserContext();

    const senderPage = await senderContext.newPage();
    const receiverPage = await receiverContext.newPage();

    senderPage.setDefaultTimeout(40000);
    receiverPage.setDefaultTimeout(40000);

    // Instrument Sender RTCPeerConnection to track instance & stats
    await senderPage.evaluateOnNewDocument(() => {
      const OrigPC = window.RTCPeerConnection;
      window.__activePeerConnections = [];
      window.RTCPeerConnection = function (config) {
        console.log("[Sender WebRTC] Instantiating RTCPeerConnection with config:", config?.iceTransportPolicy || "all");
        const pc = new OrigPC(config);
        window.__activePeerConnections.push(pc);
        window.__lastSenderPC = pc;
        return pc;
      };
      window.RTCPeerConnection.prototype = OrigPC.prototype;
    });

    // Instrument Receiver RTCPeerConnection (and force relay if 4G)
    await receiverPage.evaluateOnNewDocument((forceRelay) => {
      const OrigPC = window.RTCPeerConnection;
      window.__activePeerConnections = [];
      window.RTCPeerConnection = function (config) {
        const finalConfig = { ...config };
        if (forceRelay) {
          console.log("[Receiver 4G Sim] 📶 Forcing iceTransportPolicy: 'relay' (Simulating Carrier Symmetric NAT)");
          finalConfig.iceTransportPolicy = "relay";
        } else {
          console.log("[Receiver Wi-Fi Sim] 📶 Using default iceTransportPolicy: 'all' (Direct P2P Host / STUN)");
        }
        const pc = new OrigPC(finalConfig);
        window.__activePeerConnections.push(pc);
        window.__lastReceiverPC = pc;
        return pc;
      };
      window.RTCPeerConnection.prototype = OrigPC.prototype;
    }, forceRelayOnReceiver);

    // Diagnostics logs - print all logs for full visibility
    senderPage.on("console", (msg) => {
      console.log(`  [Sender] ${msg.text()}`);
    });
    senderPage.on("pageerror", (err) => {
      console.log(`  [Sender PageError] ${err.message}`);
    });

    receiverPage.on("console", (msg) => {
      console.log(`  [Receiver] ${msg.text()}`);
    });
    receiverPage.on("pageerror", (err) => {
      console.log(`  [Receiver PageError] ${err.message}`);
    });

    // 1. Sender opens PeerWarp homepage
    console.log(`1. Navigating Sender to ${BASE_URL}...`);
    await senderPage.goto(BASE_URL, { waitUntil: "networkidle2" });

    // 2. Sender uploads the test file
    console.log(`2. Selecting test file (${(testFileSize / 1024 / 1024).toFixed(2)} MB)...`);
    const fileInput = await senderPage.waitForSelector('input[type="file"]:not([webkitdirectory])');
    await fileInput.uploadFile(tempFilePath);
    await sleep(800);

    // 3. Sender clicks "Create Transfer Room & QR Code"
    console.log("3. Clicking 'Create Transfer Room & QR Code'...");
    const createBtn = await senderPage.waitForSelector(
      'button::-p-text("Create Transfer Room & QR Code")',
      { timeout: 8000 }
    );
    await createBtn.click();

    // 4. Retrieve Share URL
    console.log("4. Awaiting Room creation and Share URL...");
    const shareInput = await senderPage.waitForSelector("input[readonly]", { timeout: 12000 });
    const shareUrl = await senderPage.evaluate((el) => el.value, shareInput);

    if (!shareUrl || !shareUrl.includes("peerwarp.com")) {
      throw new Error(`Invalid share URL generated: ${shareUrl}`);
    }
    console.log(`   🔗 Share URL Generated: ${shareUrl}`);

    // 5. Receiver navigates to Share URL
    console.log(`5. Receiver connecting to ${shareUrl}...`);
    await receiverPage.goto(shareUrl, { waitUntil: "networkidle2" });

    // 6. Sender accepts Knock-to-Join Request
    console.log("6. Awaiting Knock-to-Join request on Sender...");
    const acceptBtn = await senderPage.waitForSelector(
      'button::-p-text("Accept & Stream")',
      { timeout: 20000 }
    );
    console.log("   ✅ Knock received! Clicking 'Accept & Stream'...");
    await acceptBtn.click();

    // 7. Monitor transfer progress on Receiver
    console.log("7. Monitoring streaming transfer & SHA-256 verification...");
    const startTime = Date.now();
    let completed = false;
    let finalDetails = null;

    for (let i = 0; i < 45; i++) {
      await sleep(1000);
      const res = await receiverPage.evaluate(() => {
        const body = document.body.innerText;
        const isComplete =
          body.includes("Transfer Complete") ||
          body.includes("Saved to Disk") ||
          body.includes("Save File");
        const isError = body.includes("Session Notice") || body.includes("Transfer interrupted");

        return { isComplete, isError, snippet: body.replace(/\s+/g, " ").slice(0, 150) };
      });

      if (i % 5 === 0 || res.isComplete) {
        console.log(`   [Progress ${i}s] ${res.snippet}`);
      }

      if (res.isError) {
        throw new Error("Transfer error detected on receiver page");
      }

      if (res.isComplete) {
        completed = true;
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
        const speedMBps = ((testFileSize / 1024 / 1024) / durationSec).toFixed(2);
        finalDetails = { durationSec, speedMBps };
        console.log(`   🎉 Transfer Completed & Verified in ${durationSec}s (~${speedMBps} MB/s)!`);
        break;
      }
    }

    if (!completed) {
      throw new Error("Transfer timed out after 45 seconds.");
    }

    // 8. Extract WebRTC ICE Connection Statistics
    console.log("8. Extracting WebRTC connection and ICE candidate stats...");
    await sleep(500);

    const stats = await receiverPage.evaluate(async () => {
      const pc = window.__lastReceiverPC;
      if (!pc) return { error: "No receiver RTCPeerConnection found" };

      const report = await pc.getStats();
      let activePair = null;
      let localCand = null;
      let remoteCand = null;

      for (const entry of report.values()) {
        if (entry.type === "transport" && entry.selectedCandidatePairId) {
          activePair = report.get(entry.selectedCandidatePairId);
        }
        if (entry.type === "candidate-pair" && (entry.selected || entry.state === "succeeded")) {
          activePair = entry;
        }
      }

      if (activePair) {
        localCand = report.get(activePair.localCandidateId);
        remoteCand = report.get(activePair.remoteCandidateId);
      }

      return {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        localCandidateType: localCand?.candidateType || "unknown",
        localProtocol: localCand?.protocol || "unknown",
        remoteCandidateType: remoteCand?.candidateType || "unknown",
        remoteProtocol: remoteCand?.protocol || "unknown",
        localAddress: localCand?.address || localCand?.ip || "unknown",
        remoteAddress: remoteCand?.address || remoteCand?.ip || "unknown",
      };
    });

    console.log("   📊 ICE Statistics:");
    console.log(`      Connection State       : ${stats.connectionState}`);
    console.log(`      ICE Connection State   : ${stats.iceConnectionState}`);
    console.log(`      Local Candidate Type   : ${stats.localCandidateType} (${stats.localProtocol})`);
    console.log(`      Remote Candidate Type  : ${stats.remoteCandidateType} (${stats.remoteProtocol})`);

    console.log(`\n✅ TEST SCENARIO [${scenarioName}] PASSED 100%`);
    return {
      success: true,
      duration: finalDetails.durationSec,
      speed: finalDetails.speedMBps,
      stats,
    };
  } catch (err) {
    console.error(`\n❌ TEST SCENARIO [${scenarioName}] FAILED:`, err.message);
    return { success: false, error: err.message };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch (_) {}
    await browser.close();
  }
}

async function runSuite() {
  console.log("======================================================================");
  console.log("⚡ PEERWARP PROTOCOL VERIFICATION: WI-FI DIRECT vs 4G CELLULAR TURN ⚡");
  console.log("======================================================================");

  // 1. Run Wi-Fi / LAN Direct P2P
  const wifiResult = await runScenario("Case 1: Wi-Fi / Local Direct P2P", false);

  await sleep(3000);

  // 2. Run 4G / Cellular Relay
  const cellResult = await runScenario("Case 2: 4G / Cellular (Forced Hetzner TURN Relay)", true);

  console.log("\n======================================================================");
  console.log("🏆 FINAL PROTOCOL VERIFICATION REPORT");
  console.log("======================================================================");
  console.log(`1. Wi-Fi / Local Direct P2P:`);
  console.log(`   - Status        : ${wifiResult.success ? "✅ PASSED" : "❌ FAILED"}`);
  if (wifiResult.success) {
    console.log(`   - Transfer Time : ${wifiResult.duration}s (${wifiResult.speed} MB/s)`);
    console.log(`   - Candidate Pair: Local [${wifiResult.stats?.localCandidateType}] <-> Remote [${wifiResult.stats?.remoteCandidateType}]`);
  }

  console.log(`2. 4G / Mobile Cellular:`);
  console.log(`   - Status        : ${cellResult.success ? "✅ PASSED" : "❌ FAILED"}`);
  if (cellResult.success) {
    console.log(`   - Transfer Time : ${cellResult.duration}s (${cellResult.speed} MB/s)`);
    console.log(`   - Candidate Pair: Local [${cellResult.stats?.localCandidateType}] <-> Remote [${cellResult.stats?.remoteCandidateType}]`);
  }
  console.log("======================================================================");

  if (!wifiResult.success || !cellResult.success) {
    process.exit(1);
  }
}

runSuite();
