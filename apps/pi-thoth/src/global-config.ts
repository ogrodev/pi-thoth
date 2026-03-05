/**
 * global-config.ts — Modifies ~/.omp/agent/config.yml to enable th0th integration.
 *
 * Uses line-by-line string manipulation (no YAML parser dependency) to preserve
 * formatting and comments. Only touches the specific entries we care about.
 */

import fs from "fs";
import path from "path";
import os from "os";

export interface GlobalConfigResult {
  messages: string[];
}

const OMP_AGENT_DIR = path.join(os.homedir(), ".omp", "agent");
const CONFIG_YML_PATH = path.join(OMP_AGENT_DIR, "config.yml");
const EXTENSIONS_DIR = path.join(OMP_AGENT_DIR, "extensions");
const PI_THOTH_EXT_DIR = path.join(EXTENSIONS_DIR, "pi-thoth");
const DISABLED_SKILL_ENTRY = "skill:th0th-memory";

/**
 * Ensure global ~/.omp/agent/config.yml is configured correctly:
 *  - Remove `skill:th0th-memory` from disabledExtensions (if present)
 *  - Print advisory if pi-thoth extension is not globally installed
 *
 * No-op if ~/.omp/ doesn't exist (non-omp user).
 */
export async function ensureGlobalConfig(): Promise<GlobalConfigResult> {
  const messages: string[] = [];

  // Verify omp is installed
  if (!fs.existsSync(OMP_AGENT_DIR)) {
    messages.push(`~/.omp/agent/ not found — skipping global config (not an oh-my-pi user?)`);
    return { messages };
  }

  // Check for pi-thoth global extension
  if (!fs.existsSync(PI_THOTH_EXT_DIR)) {
    messages.push(
      `Advisory: @ogrodev/pi-thoth extension not found at ${PI_THOTH_EXT_DIR}`,
    );
    messages.push(`  Install it with: npx omp-ext install @ogrodev/pi-thoth`);
  }

  // Modify config.yml if it exists
  if (!fs.existsSync(CONFIG_YML_PATH)) {
    messages.push(`~/.omp/agent/config.yml not found — skipping (will work without it)`);
    return { messages };
  }

  const modified = removeFromDisabledExtensions(CONFIG_YML_PATH, DISABLED_SKILL_ENTRY);
  if (modified) {
    messages.push(`Enabled skill:th0th-memory in ~/.omp/agent/config.yml`);
  }

  return { messages };
}

/**
 * Remove a specific entry from the `disabledExtensions` YAML array.
 * Uses line-by-line manipulation — preserves all formatting and comments.
 *
 * Returns true if the file was modified.
 */
function removeFromDisabledExtensions(configPath: string, entry: string): boolean {
  const raw = fs.readFileSync(configPath, "utf-8");
  const lines = raw.split("\n");

  let inDisabledExtensions = false;
  let modified = false;
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect entry into the disabledExtensions block
    if (/^disabledExtensions\s*:/.test(trimmed)) {
      inDisabledExtensions = true;
      result.push(line);
      continue;
    }

    // Exit the block when we hit a non-indented, non-list line
    if (inDisabledExtensions && trimmed && !trimmed.startsWith("-") && !/^\s/.test(line)) {
      inDisabledExtensions = false;
    }

    // Remove the target entry
    if (inDisabledExtensions && trimmed === `- ${entry}`) {
      modified = true;
      // Skip this line (effectively removes the entry)
      continue;
    }

    result.push(line);
  }

  if (modified) {
    fs.writeFileSync(configPath, result.join("\n"), "utf-8");
  }

  return modified;
}
