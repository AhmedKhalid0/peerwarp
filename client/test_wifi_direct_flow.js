const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "https://peerwarp.com";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log("======================================================================");
  console.log("🚀 STARTING E2E AUTOMATED TEST: LOCAL WI-FI AIRDROP ONE-CLICK FLOW");
  console.log("======================================================================");

  // 1. Create temporary sample file to AirDrop
  const sampleFilePath = path.join(__dirname, `airdrop_payload_${Date.now()}.bin`);
  const buf = Buffer.alloc(1024 * 1024); // 1 MB
  for (let i = 0; i < buf.length; i++) buf[i] = (i * 17) % 256;
  fs.writeFileSync(sampleFilePath, buf);

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
    const laptopContext = await browser.createBrowserContext();
    const mobileContext = await browser.createBrowserContext();

    const laptopPage = await laptopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    laptopPage.setDefaultTimeout(35000);
    mobilePage.setDefaultTimeout(35000);

    laptopPage.on("console", (msg) => {
      const t = msg.text();
      if (t.includes("[WebRTC") || t.includes("Radar") || t.includes("AirDrop")) {
        console.log(`  [Laptop] ${t}`);
      }
    });

    mobilePage.on("console", (msg) => {
      const t = msg.text();
      if (t.includes("[WebRTC") || t.includes("Radar") || t.includes("AirDrop") || t.includes("Transfer")) {
        console.log(`  [Mobile] ${t}`);
      }
    });

    // Step 1: Open both devices on peerwarp.com
    console.log("1. Opening Laptop on https://peerwarp.com...");
    await laptopPage.goto(BASE_URL, { waitUntil: "networkidle2" });

    console.log("2. Opening Mobile on https://peerwarp.com...");
    await mobilePage.goto(BASE_URL, { waitUntil: "networkidle2" });

    // Step 2: Switch both to Wi-Fi Direct tab
    console.log("3. Switching both devices to 'Wi-Fi Direct' tab...");
    const laptopRadarTab = await laptopPage.waitForSelector("#tab-radar, button::-p-text('Wi-Fi Direct')");
    await laptopRadarTab.click();

    const mobileRadarTab = await mobilePage.waitForSelector("#tab-radar, button::-p-text('Wi-Fi Direct')");
    await mobileRadarTab.click();

    // Step 3: Await mutual discovery
    console.log("4. Awaiting zero-config local network discovery...");
    let discovered = false;
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      const hasDeviceOnLaptop = await laptopPage.evaluate(() => {
        return document.body.innerText.includes("Ready to receive");
      });
      const hasDeviceOnMobile = await mobilePage.evaluate(() => {
        return document.body.innerText.includes("Ready to receive");
      });
      if (hasDeviceOnLaptop && hasDeviceOnMobile) {
        discovered = true;
        console.log("   ✅ Both devices discovered each other on local Wi-Fi!");
        break;
      }
    }

    if (!discovered) {
      throw new Error("Local Wi-Fi Radar discovery timed out.");
    }

    // Step 4: Laptop selects device and files to initiate AirDrop
    console.log("5. Laptop clicks 'Send to Device' and selects payload...");
    const sendBtn = await laptopPage.waitForSelector('button::-p-text("Send to Device")');
    await sendBtn.click();
    await sleep(400);

    const radarInput = await laptopPage.waitForSelector('input[type="file"]');
    await radarInput.uploadFile(sampleFilePath);

    // Step 5: Mobile receives AirDrop invitation modal
    console.log("6. Checking for instant AirDrop prompt on Mobile...");
    const acceptBtn = await mobilePage.waitForSelector(
      'button::-p-text("Accept & Download")',
      { timeout: 15000 }
    );
    console.log("   ✅ Mobile received AirDrop request! Clicking 'Accept & Download'...");
    await acceptBtn.click();

    // Step 6: Verify streaming and transfer completion
    console.log("7. Monitoring streaming transfer on Mobile...");
    const startTime = Date.now();
    let transferCompleted = false;

    for (let i = 0; i < 35; i++) {
      await sleep(1000);
      const status = await mobilePage.evaluate(() => {
        const body = document.body.innerText;
        return {
          isComplete:
            body.includes("Transfer Complete") ||
            body.includes("Saved to Disk") ||
            body.includes("Save File"),
          snippet: body.slice(0, 160).replace(/\s+/g, " "),
        };
      });

      if (i % 3 === 0 || status.isComplete) {
        console.log(`   [Progress ${i}s] ${status.snippet}`);
      }

      if (status.isComplete) {
        transferCompleted = true;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 AIRDROP FILE TRANSFER COMPLETED & VERIFIED IN ${elapsed}s!`);
        break;
      }
    }

    if (!transferCompleted) {
      throw new Error("AirDrop transfer failed to complete within timeout.");
    }

    console.log("\n======================================================================");
    console.log("🏆 AIRDROP AUTOMATED TEST RESULT: ✅ 100% PASSED");
    console.log("======================================================================");
  } catch (err) {
    console.error("\n❌ AIRDROP TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    try {
      if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);
    } catch (_) {}
    await browser.close();
  }
})();
