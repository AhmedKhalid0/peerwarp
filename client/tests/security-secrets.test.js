/**
 * Security Test Suite: Secrets & Credentials Leak Scanner
 * Ensures no API keys, private keys, or hardcoded passwords exist in codebase or git.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "../..");

const DANGEROUS_PATTERNS = [
  { name: "Private RSA/EC/OPENSSH Key", regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/i },
  { name: "Hardcoded Static TURN Credential (WarpSecure)", regex: /WarpSecure2026Turn/i },
  { name: "Exposed GitHub Personal Access Token", regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: "Exposed OpenAI / Anthropic API Key", regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: "Exposed AWS Secret Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Hardcoded Cloudflare Global API Key", regex: /api_key\s*[:=]\s*["'][a-f0-9]{37}["']/i },
  { name: "Hardcoded DB Password String", regex: /postgres:\/\/[^:]+:[^@]+@/i },
];

const IGNORED_PATHS = [
  ".git",
  "node_modules",
  ".next",
  "out",
  ".pytest_cache",
  ".venv",
  "package-lock.json",
  "scratch",
  "security-secrets.test.js" // Exclude self
];

function scanDirectory(dir, issues = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (IGNORED_PATHS.some((ignored) => relPath.split(path.sep).includes(ignored))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, issues);
    } else if (entry.isFile()) {
      // Check file extension
      const ext = path.extname(entry.name).toLowerCase();
      if (![".ts", ".tsx", ".js", ".jsx", ".json", ".py", ".yml", ".yaml", ".md", ".sh", ".toml"].includes(ext)) {
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.regex.test(content)) {
            issues.push({
              file: relPath,
              leakType: pattern.name,
            });
          }
        }
      } catch (err) {
        // Skip binary or unreadable files
      }
    }
  }

  return issues;
}

function verifyGitIgnore() {
  const gitignorePath = path.join(ROOT_DIR, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    throw new Error(".gitignore file is missing at repository root!");
  }
  const content = fs.readFileSync(gitignorePath, "utf-8");
  const requiredPatterns = [".env", ".env.local", "node_modules", ".wrangler"];
  const missing = [];
  for (const req of requiredPatterns) {
    if (!content.includes(req)) {
      missing.push(req);
    }
  }
  if (missing.length > 0) {
    throw new Error(`.gitignore is missing rules for: ${missing.join(", ")}`);
  }
}

async function run() {
  console.log("  🔍 Scanning repository for secrets & sensitive tokens...");
  
  // 1. Verify .gitignore rules
  verifyGitIgnore();
  console.log("  ✅ .gitignore properly excludes .env*, node_modules, and .wrangler");

  // 2. Scan tracked directories
  const leaks = scanDirectory(ROOT_DIR);
  if (leaks.length > 0) {
    console.error("  ❌ FOUND POTENTIAL SECRET LEAKS:");
    for (const leak of leaks) {
      console.error(`     - [${leak.leakType}] in file: ${leak.file}`);
    }
    throw new Error(`Found ${leaks.length} potential secrets in repository.`);
  }

  console.log("  ✅ Zero secrets, private keys, or exposed tokens detected in source tree.");
  return true;
}

module.exports = { run };

if (require.main === module) {
  run().then(() => process.exit(0)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
