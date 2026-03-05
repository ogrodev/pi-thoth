/**
 * omp-setup.ts — Scaffolds `.omp/` directory structure for oh-my-pi integration.
 *
 * Responsibilities:
 *  1. Write .omp/mcp.json (merge with existing — never clobber)
 *  2. Write .omp/settings.json (deep merge)
 *  3. Write .omp/skills/th0th-memory/SKILL.md (skip if exists)
 *  4. Write .omp/extensions/th0th-auto-index/index.ts (always overwrite)
 *  5. Write .omp/commands/*.md (skip each if exists)
 *  6. Extend .gitignore with auto-index extension entry
 *
 * All operations are idempotent. Running init twice produces no duplicates.
 */

import fs from "fs";
import path from "path";
import os from "os";
import {
  MCP_SERVER_KEY,
  defaultMcpServer,
  defaultOmpSettings,
  SKILL_TEMPLATE,
  AUTO_INDEX_EXTENSION_TEMPLATE,
  COMMANDS,
} from "./templates.js";
import type { McpConfig, OmpSettings } from "./templates.js";

export interface OmpSetupOptions {
  projectRoot: string;
  skipGlobal?: boolean;
  setupPi?: boolean;
}

export interface OmpSetupResult {
  success: boolean;
  messages: string[];
  filesCreated: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deeply merge `source` into `target`. Arrays are replaced, not concatenated.
 * Mutates `target` in place and returns it.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      (target as Record<string, unknown>)[key] = value;
    }
  }
  return target;
}

/**
 * Write a file only if it does not already exist.
 * Returns "created" | "skipped".
 */
function writeIfAbsent(filePath: string, content: string): "created" | "skipped" {
  if (fs.existsSync(filePath)) {
    return "skipped";
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return "created";
}

/**
 * Write a file unconditionally (always latest version).
 */
function writeAlways(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Step implementations
// ---------------------------------------------------------------------------

function setupMcpJson(ompDir: string, messages: string[], filesCreated: string[]): void {
  const mcpPath = path.join(ompDir, "mcp.json");

  let existing: McpConfig = { servers: {} };
  if (fs.existsSync(mcpPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(mcpPath, "utf-8")) as McpConfig;
    } catch {
      messages.push(`Warning: .omp/mcp.json exists but is invalid JSON — will merge carefully`);
    }
    if (!existing.servers) {
      existing.servers = {};
    }
    if (existing.servers[MCP_SERVER_KEY]) {
      messages.push(`.omp/mcp.json: th0th server already configured — skipped`);
      return;
    }
  }

  existing.servers[MCP_SERVER_KEY] = defaultMcpServer;
  fs.mkdirSync(ompDir, { recursive: true });
  fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  filesCreated.push(mcpPath);
  messages.push(`Created .omp/mcp.json with th0th MCP server`);
}

function setupSettingsJson(ompDir: string, messages: string[], filesCreated: string[]): void {
  const settingsPath = path.join(ompDir, "settings.json");

  let merged: OmpSettings = deepMerge({} as OmpSettings, defaultOmpSettings as Record<string, unknown>);

  if (fs.existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as OmpSettings;
      // Deep merge existing on top of defaults so user settings win, then apply defaults for missing keys
      merged = deepMerge(
        deepMerge({} as OmpSettings, defaultOmpSettings as Record<string, unknown>),
        existing as Record<string, unknown>,
      );
      messages.push(`.omp/settings.json: merged with existing settings`);
    } catch {
      messages.push(`Warning: .omp/settings.json exists but is invalid JSON — overwriting`);
    }
  } else {
    messages.push(`Created .omp/settings.json`);
    filesCreated.push(settingsPath);
  }

  fs.mkdirSync(ompDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

function setupSkill(ompDir: string, messages: string[], filesCreated: string[]): void {
  const skillPath = path.join(ompDir, "skills", "th0th-memory", "SKILL.md");
  const result = writeIfAbsent(skillPath, SKILL_TEMPLATE);
  if (result === "created") {
    filesCreated.push(skillPath);
    messages.push(`Created .omp/skills/th0th-memory/SKILL.md`);
  } else {
    messages.push(`.omp/skills/th0th-memory/SKILL.md: already exists — skipped`);
  }
}

function setupExtension(ompDir: string, messages: string[], filesCreated: string[]): void {
  const extPath = path.join(ompDir, "extensions", "th0th-auto-index", "index.ts");
  const existed = fs.existsSync(extPath);
  writeAlways(extPath, AUTO_INDEX_EXTENSION_TEMPLATE);
  if (existed) {
    messages.push(`.omp/extensions/th0th-auto-index/index.ts: updated to latest version`);
  } else {
    filesCreated.push(extPath);
    messages.push(`Created .omp/extensions/th0th-auto-index/index.ts`);
  }
}

function setupCommands(ompDir: string, messages: string[], filesCreated: string[]): void {
  for (const [name, { filename, content }] of Object.entries(COMMANDS)) {
    const cmdPath = path.join(ompDir, "commands", filename);
    const result = writeIfAbsent(cmdPath, content);
    if (result === "created") {
      filesCreated.push(cmdPath);
      messages.push(`Created .omp/commands/${filename}`);
    } else {
      messages.push(`.omp/commands/${filename}: already exists — skipped`);
    }
  }
}

function setupGitignore(projectRoot: string, messages: string[]): void {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const entry = ".omp/extensions/th0th-auto-index/";

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (content.split("\n").some((l) => l.trim() === entry)) {
      return;
    }
    fs.appendFileSync(gitignorePath, `\n# pi-thoth auto-generated extension (do not commit)\n${entry}\n`);
  } else {
    fs.writeFileSync(gitignorePath, `# pi-thoth auto-generated extension (do not commit)\n${entry}\n`);
  }
  messages.push(`Added ${entry} to .gitignore`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scaffold `.omp/` project integration for oh-my-pi.
 *
 * Idempotent — safe to call on an already-configured project.
 */
export async function setupOmp(options: OmpSetupOptions): Promise<OmpSetupResult> {
  const { projectRoot, skipGlobal = false } = options;
  const ompDir = path.join(projectRoot, ".omp");
  const messages: string[] = [];
  const filesCreated: string[] = [];

  try {
    setupMcpJson(ompDir, messages, filesCreated);
    setupSettingsJson(ompDir, messages, filesCreated);
    setupSkill(ompDir, messages, filesCreated);
    setupExtension(ompDir, messages, filesCreated);
    setupCommands(ompDir, messages, filesCreated);
    setupGitignore(projectRoot, messages);

    if (!skipGlobal) {
      const { ensureGlobalConfig } = await import("./global-config.js");
      const globalResult = await ensureGlobalConfig();
      messages.push(...globalResult.messages);
    }

    return { success: true, messages, filesCreated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      messages: [...messages, `Error: ${msg}`],
      filesCreated,
    };
  }
}

// ---------------------------------------------------------------------------
// Path helpers (exported for testing)
// ---------------------------------------------------------------------------

export function getOmpDir(projectRoot: string): string {
  return path.join(projectRoot, ".omp");
}

export function getGlobalOmpDir(): string {
  return path.join(os.homedir(), ".omp");
}
