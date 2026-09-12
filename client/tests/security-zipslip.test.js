/**
 * Security Test Suite: Zip Slip & Path Traversal Immunity
 * Validates that zip.ts sanitization prevents arbitrary file writes & directory escapes.
 */

async function run() {
  console.log("  🛡️ Testing Zip Slip & Directory Traversal immunity...");

  // Import sanitizeZipPath from TypeScript source
  const { sanitizeZipPath } = await import("../src/lib/zip.ts");

  const attackVectors = [
    { input: "../../../../etc/passwd", desc: "Deep Unix directory traversal" },
    { input: "..\\..\\windows\\system32\\cmd.exe", desc: "Deep Windows directory traversal" },
    { input: "....//....//config.json", desc: "Double-dot evasion with double slashes" },
    { input: "folder/../../../root.txt", desc: "Mid-path directory escape" },
    { input: "C:\\Windows\\System32\\calc.exe", desc: "Windows absolute drive path" },
    { input: "D:/secret/passwords.txt", desc: "Windows absolute path with forward slash" },
    { input: "/var/log/syslog", desc: "Absolute Unix root path" },
    { input: "normal/path/test\x00.exe", desc: "Null byte injection attempt" },
    { input: "..", desc: "Bare double dot" },
    { input: "../", desc: "Bare double dot with slash" },
    { input: ".../...//", desc: "Multi-dot sequence" },
    { input: "   /spaces/before/   ", desc: "Whitespace padded traversal" },
  ];

  let passedCount = 0;

  for (const testCase of attackVectors) {
    const sanitized = sanitizeZipPath(testCase.input);

    // Assertions
    const hasDoubleDot = sanitized.includes("..") || /(^|\/)\.\.(\/|$)/.test(sanitized);
    const hasDriveLetter = /^[a-zA-Z]:/.test(sanitized);
    const hasLeadingSlash = sanitized.startsWith("/") || sanitized.startsWith("\\");
    const hasNullByte = sanitized.includes("\0") || /[\x00-\x1f\x7f]/.test(sanitized);

    if (hasDoubleDot || hasDriveLetter || hasLeadingSlash || hasNullByte) {
      console.error(`  ❌ VULNERABILITY DETECTED in: "${testCase.desc}"`);
      console.error(`     Raw input: "${testCase.input}"`);
      console.error(`     Sanitized output: "${sanitized}"`);
      throw new Error(`Zip Slip vulnerability not mitigated for: ${testCase.desc}`);
    }

    // Must return a non-empty string
    if (!sanitized || sanitized.length === 0) {
      throw new Error(`Sanitizer returned empty string for: ${testCase.desc}`);
    }

    passedCount++;
  }

  // Also test legitimate relative paths remain intact
  const legitimate = sanitizeZipPath("documents/report.pdf");
  if (legitimate !== "documents/report.pdf") {
    throw new Error(`Sanitizer corrupted valid path: expected "documents/report.pdf", got "${legitimate}"`);
  }

  console.log(`  ✅ All ${passedCount + 1} Zip Slip attack vectors successfully neutralized.`);
  return true;
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
