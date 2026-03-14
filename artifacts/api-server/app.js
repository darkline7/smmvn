"use strict";
/**
 * SMM Panel Pro — cPanel Node.js Startup File
 *
 * This file is the entry point run by cPanel Node.js Selector.
 * It loads environment variables from .env (if present) then starts
 * the bundled Express server from dist/index.cjs.
 *
 * Usage: node app.js
 */

const fs = require("fs");
const path = require("path");

// ── Inline .env loader ────────────────────────────────────────────────────────
// Reads KEY=VALUE lines from .env in the same directory as app.js.
// Variables already set in the system environment take priority.
// This allows cPanel Environment Variables UI to always override .env.
(function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      // Skip blank lines and comments
      if (!line || line.startsWith("#")) continue;

      const eqIdx = line.indexOf("=");
      if (eqIdx < 1) continue;

      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();

      // Strip surrounding quotes (single or double)
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      // System env takes precedence over .env
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
    console.log("[app.js] Loaded environment from .env");
  } catch (err) {
    console.warn("[app.js] Could not read .env:", err.message);
  }
})();

// ── Validate critical environment variables ───────────────────────────────────
const required = {
  DATABASE_URL: "PostgreSQL connection string (from neon.tech or your DB host)",
  JWT_SECRET:   "Random 128-char hex string for signing auth tokens",
};

let missingVars = [];
for (const [key, description] of Object.entries(required)) {
  if (!process.env[key]) {
    missingVars.push(`  ${key}  →  ${description}`);
  }
}

if (missingVars.length > 0) {
  console.error(
    "\n[app.js] FATAL: Missing required environment variables:\n" +
    missingVars.join("\n") +
    "\n\nSet these in:\n" +
    "  • cPanel → Node.js → Environment Variables\n" +
    "  • OR in the .env file in this directory\n" +
    "\nSee .env.example for reference.\n"
  );
  process.exit(1);
}

// ── Set production defaults ───────────────────────────────────────────────────
if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";
if (!process.env.PORT)     process.env.PORT = "3000";

// ── Start the server ──────────────────────────────────────────────────────────
console.log("[app.js] Starting SMM Panel Pro...");
console.log("[app.js] Node.js", process.version, "| ENV:", process.env.NODE_ENV, "| Port:", process.env.PORT);

try {
  require("./dist/index.cjs");
} catch (err) {
  console.error("[app.js] Failed to load dist/index.cjs:", err);
  process.exit(1);
}
