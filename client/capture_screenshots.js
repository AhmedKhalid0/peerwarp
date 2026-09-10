const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.resolve(__dirname, "../docs/screenshots");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function capture() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log("Launching headless Chrome for PeerWarp screenshots...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(20000);

  // 1. Desktop Workspace Light Mode
  console.log("Capturing 01_desktop_workspace_light.png...");
  await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("peerwarp_theme", "light");
    document.documentElement.classList.remove("dark");
  });
  await sleep(2000);
  await page.screenshot({
    path: path.join(OUT_DIR, "01_desktop_workspace_light.png"),
    fullPage: false,
  });

  // 2. Transfer Session & Pairing in Dark Mode
  console.log("Capturing 02_transfer_session_dark.png...");
  await page.evaluate(() => {
    localStorage.setItem("peerwarp_theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await sleep(1000);

  // Simulate file selection and start transfer
  await page.evaluate(() => {
    // Create dummy files and trigger send state
    const dt = new DataTransfer();
    const file1 = new File(["dummy content 1"], "Production_Master_4K_Reel.mp4", { type: "video/mp4" });
    const file2 = new File(["dummy content 2"], "Client_Archive_2026_Assets.zip", { type: "application/zip" });
    dt.items.add(file1);
    dt.items.add(file2);

    const input = document.querySelector("input[type='file']");
    if (input) {
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await sleep(1500);

  // Click "Create Transfer Room" button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const createBtn = btns.find((b) => b.textContent.includes("Create Transfer Room"));
    if (createBtn) createBtn.click();
  });
  await sleep(2500);

  await page.screenshot({
    path: path.join(OUT_DIR, "02_transfer_session_dark.png"),
    fullPage: false,
  });

  // 3. One-Touch QR Code Mobile Pairing (Focus view)
  console.log("Capturing 03_qr_mobile_pairing.png...");
  await page.screenshot({
    path: path.join(OUT_DIR, "03_qr_mobile_pairing.png"),
    fullPage: false,
  });

  // 4. Receiver Room Page
  console.log("Capturing 04_receiver_verified.png...");
  await page.goto("http://localhost:3001/WARP-739", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("peerwarp_theme", "light");
    document.documentElement.classList.remove("dark");
  });
  await sleep(2500);
  await page.screenshot({
    path: path.join(OUT_DIR, "04_receiver_verified.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("SUCCESS: All 4 screenshots captured cleanly!");
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
