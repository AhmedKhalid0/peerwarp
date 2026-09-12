/**
 * Operational Test Suite: TypeScript Static Typecheck & Build Integrity
 * Ensures zero type errors and verifies compilation readiness before deployment.
 */

const { execSync } = require("child_process");
const path = require("path");

const CLIENT_DIR = path.resolve(__dirname, "..");

async function run() {
  console.log("  ⚡ Running TypeScript typecheck (tsc --noEmit)...");

  try {
    const output = execSync("npx tsc --noEmit", {
      cwd: CLIENT_DIR,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log("  ✅ TypeScript typecheck passed with 0 errors.");
    return true;
  } catch (err) {
    console.error("  ❌ TypeScript compilation errors detected:");
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    throw new Error("TypeScript typecheck failed!");
  }
}

module.exports = { run };

if (require.main === module) {
  run()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error("  ❌ Test Failed:", err.message);
      process.exitCode = 1;
    });
}
