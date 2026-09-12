const puppeteer = require("puppeteer-core");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const c1 = await browser.createBrowserContext();
    const c2 = await browser.createBrowserContext();

    const p1 = await c1.newPage();
    const p2 = await c2.newPage();

    console.log("1. Opening Device 1 (Laptop) on https://peerwarp.com...");
    await p1.goto("https://peerwarp.com", { waitUntil: "networkidle2" });

    console.log("2. Opening Device 2 (Mobile) on https://peerwarp.com...");
    await p2.goto("https://peerwarp.com", { waitUntil: "networkidle2" });

    console.log("3. Clicking 'Wi-Fi Radar' tab on both devices...");
    const tab1 = await p1.waitForSelector('button::-p-text("Wi-Fi Radar")');
    await tab1.click();

    const tab2 = await p2.waitForSelector('button::-p-text("Wi-Fi Radar")');
    await tab2.click();

    console.log("4. Awaiting discovery broadcast...");
    await new Promise((r) => setTimeout(r, 4500));

    const res1 = await p1.evaluate(() => {
      return {
        hasPair: document.body.innerText.includes("Ready to pair"),
        peersCount: document.querySelectorAll("button").length,
        text: document.body.innerText.slice(0, 300),
      };
    });

    const res2 = await p2.evaluate(() => {
      return {
        hasPair: document.body.innerText.includes("Ready to pair"),
        peersCount: document.querySelectorAll("button").length,
      };
    });

    console.log("Device 1 Discovery Status:", res1.hasPair ? "✅ FOUND DEVICE 2!" : "❌ Still scanning...");
    console.log("Device 2 Discovery Status:", res2.hasPair ? "✅ FOUND DEVICE 1!" : "❌ Still scanning...");
  } catch (err) {
    console.error("Radar test error:", err);
  } finally {
    await browser.close();
  }
})();
