/**
 * PeerWarp Comprehensive Security & Operational Test Suite Runner
 * Executes all automated security audits, anti-proxy tests, protocol integrity,
 * and operational checks in sequence.
 */

const path = require("path");

const securityTests = [
  { name: "Secrets & Git Leak Scanner", file: "./security-secrets.test.js" },
  { name: "Zip Slip & Directory Traversal Immunity", file: "./security-zipslip.test.js" },
  { name: "TURN Anti-Proxy Enforcement (401 on Static/Unauthorized)", file: "./security-turn-antiproxy.test.js" },
  { name: "Edge API, Ephemeral HMAC Tokens & Rate Limiting", file: "./security-edge-api.test.js" },
];

const operationalTests = [
  { name: "Protocol Chunking & CRC32 Data Integrity", file: "./ops-protocol-chunking.test.js" },
  { name: "Resumable Transfer State Machine & Handshake", file: "./ops-resumable-state.test.js" },
  { name: "TypeScript Static Compilation & Typecheck", file: "./ops-build-typecheck.test.js" },
];

async function runSuite() {
  const args = process.argv.slice(2);
  const securityOnly = args.includes("--security-only");
  const opsOnly = args.includes("--ops-only");

  let suitesToRun = [];

  if (securityOnly) {
    suitesToRun = [{ title: "SECURITY & HARDENING AUDIT", tests: securityTests }];
  } else if (opsOnly) {
    suitesToRun = [{ title: "OPERATIONAL & PROTOCOL INTEGRITY", tests: operationalTests }];
  } else {
    suitesToRun = [
      { title: "SECURITY & HARDENING AUDIT", tests: securityTests },
      { title: "OPERATIONAL & PROTOCOL INTEGRITY", tests: operationalTests },
    ];
  }

  console.log("\n================================================================================");
  console.log(" 🚀 PEERWARP AUTOMATED VERIFICATION SUITE (SECURITY & OPERATIONS)");
  console.log("================================================================================\n");

  const overallStart = Date.now();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureDetails = [];

  for (const group of suitesToRun) {
    console.log(`\n--- 📋 [${group.title}] ---`);

    for (const test of group.tests) {
      totalTests++;
      process.stdout.write(`\n▶ [${test.name}]\n`);
      const start = Date.now();

      try {
        const testModule = require(test.file);
        await testModule.run();
        const duration = Date.now() - start;
        console.log(`  ✨ [PASS] ${test.name} (${duration}ms)`);
        passedTests++;
      } catch (err) {
        const duration = Date.now() - start;
        console.error(`  💥 [FAIL] ${test.name} (${duration}ms): ${err.message}`);
        failedTests++;
        failureDetails.push({ name: test.name, error: err.message });
      }
    }
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log("\n================================================================================");
  console.log(" 📊 FINAL VERIFICATION REPORT");
  console.log("================================================================================");
  console.log(` Total Suites Executed : ${totalTests}`);
  console.log(` Passed                : ${passedTests} ✅`);
  console.log(` Failed                : ${failedTests} ${failedTests > 0 ? "❌" : ""}`);
  console.log(` Total Duration        : ${totalDuration}s`);

  if (failedTests > 0) {
    console.error("\n❌ SUMMARY OF FAILURES:");
    for (const fail of failureDetails) {
      console.error(`   - ${fail.name}: ${fail.error}`);
    }
    console.log("\n❌ Project failed automated verification. Please fix issues before deploying.\n");
    process.exitCode = 1;
  } else {
    console.log("\n🎉 ALL TESTS PASSED! Project is secure, healthy, and ready for deployment.\n");
    process.exitCode = 0;
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exitCode = 1;
});
