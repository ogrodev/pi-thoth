/**
 * Unit tests for omp-setup.ts
 *
 * Uses real temp directories (mkdtemp) for full-fidelity I/O testing.
 * No fs mocking — the operations are simple enough that real I/O is cleaner.
 */

import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";

// Unit under test — we need a relative import since there's no package alias
import { setupOmp } from "../omp-setup.js";
import { MCP_SERVER_KEY, SKILL_TEMPLATE, AUTO_INDEX_EXTENSION_TEMPLATE, COMMANDS } from "../templates.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-thoth-test-"));
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTempDir();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("setupOmp — basic scaffolding", () => {
  test("creates all expected files on a clean project", async () => {
    const result = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    expect(result.success).toBe(true);

    const ompDir = path.join(tmpDir, ".omp");
    expect(fs.existsSync(path.join(ompDir, "mcp.json"))).toBe(true);
    expect(fs.existsSync(path.join(ompDir, "settings.json"))).toBe(true);
    expect(fs.existsSync(path.join(ompDir, "skills", "th0th-memory", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(ompDir, "extensions", "th0th-auto-index", "index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(ompDir, "commands", "index-project.md"))).toBe(true);
    expect(fs.existsSync(path.join(ompDir, "commands", "search-code.md"))).toBe(true);
    expect(fs.existsSync(path.join(ompDir, "commands", "remember.md"))).toBe(true);
  });

  test("mcp.json contains th0th server with correct shape", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const mcpPath = path.join(tmpDir, ".omp", "mcp.json");
    const mcp = readJson(mcpPath) as { servers: Record<string, unknown> };

    expect(mcp.servers).toBeDefined();
    expect(mcp.servers[MCP_SERVER_KEY]).toEqual({
      type: "stdio",
      command: "bunx",
      args: ["pi-thoth"],
      enabled: true,
      timeout: 30,
    });
  });

  test("settings.json contains skills config", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const settingsPath = path.join(tmpDir, ".omp", "settings.json");
    const settings = readJson(settingsPath) as { skills: Record<string, unknown> };

    expect(settings.skills?.enabled).toBe(true);
    expect(settings.skills?.enableSkillCommands).toBe(true);
  });

  test("SKILL.md content matches template", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const skillPath = path.join(tmpDir, ".omp", "skills", "th0th-memory", "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf-8");

    expect(content).toBe(SKILL_TEMPLATE);
    expect(content).toContain("name: th0th-memory");
    expect(content).toContain("th0th_index");
  });

  test("auto-index extension content matches template", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const extPath = path.join(tmpDir, ".omp", "extensions", "th0th-auto-index", "index.ts");
    const content = fs.readFileSync(extPath, "utf-8");

    expect(content).toBe(AUTO_INDEX_EXTENSION_TEMPLATE);
    expect(content).toContain("session_start");
    expect(content).toContain("vector-store.db");
  });

  test("command files have correct frontmatter", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    for (const [, { filename }] of Object.entries(COMMANDS)) {
      const cmdPath = path.join(tmpDir, ".omp", "commands", filename);
      const content = fs.readFileSync(cmdPath, "utf-8");
      expect(content).toContain("description:");
    }
  });

  test("adds .omp/extensions/th0th-auto-index/ to .gitignore", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".omp/extensions/th0th-auto-index/");
  });
});

describe("setupOmp — merge behavior with existing files", () => {
  test("does not clobber existing mcp.json with other servers", async () => {
    const ompDir = path.join(tmpDir, ".omp");
    fs.mkdirSync(ompDir, { recursive: true });

    const existing = {
      servers: {
        postgres: { type: "stdio", command: "psql", args: [], enabled: true, timeout: 10 },
      },
    };
    fs.writeFileSync(path.join(ompDir, "mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const mcp = readJson(path.join(ompDir, "mcp.json")) as { servers: Record<string, unknown> };
    expect(mcp.servers.postgres).toBeDefined();
    expect(mcp.servers[MCP_SERVER_KEY]).toBeDefined();
  });

  test("skips th0th server if already present in mcp.json", async () => {
    const ompDir = path.join(tmpDir, ".omp");
    fs.mkdirSync(ompDir, { recursive: true });

    const existing = {
      servers: {
        [MCP_SERVER_KEY]: { type: "stdio", command: "bunx", args: ["pi-thoth"], enabled: true, timeout: 30 },
      },
    };
    fs.writeFileSync(path.join(ompDir, "mcp.json"), JSON.stringify(existing, null, 2), "utf-8");

    const result = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    expect(result.messages.some((m) => m.includes("already configured"))).toBe(true);
  });

  test("deep merges settings.json with existing settings", async () => {
    const ompDir = path.join(tmpDir, ".omp");
    fs.mkdirSync(ompDir, { recursive: true });

    const existing = {
      theme: "dark",
      skills: {
        customOption: true,
      },
    };
    fs.writeFileSync(path.join(ompDir, "settings.json"), JSON.stringify(existing, null, 2), "utf-8");

    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const settings = readJson(path.join(ompDir, "settings.json")) as Record<string, unknown> & {
      skills: Record<string, unknown>;
    };
    // Existing keys preserved
    expect(settings.theme).toBe("dark");
    expect(settings.skills.customOption).toBe(true);
    // New keys added
    expect(settings.skills.enabled).toBe(true);
    expect(settings.skills.enableSkillCommands).toBe(true);
  });

  test("does not overwrite existing SKILL.md (user may have customized)", async () => {
    const skillDir = path.join(tmpDir, ".omp", "skills", "th0th-memory");
    fs.mkdirSync(skillDir, { recursive: true });
    const customContent = "# My custom skill\nDo not overwrite me.";
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), customContent, "utf-8");

    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const content = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toBe(customContent);
  });

  test("always overwrites extension (ensures latest version)", async () => {
    const extDir = path.join(tmpDir, ".omp", "extensions", "th0th-auto-index");
    fs.mkdirSync(extDir, { recursive: true });
    const staleContent = "// stale version";
    fs.writeFileSync(path.join(extDir, "index.ts"), staleContent, "utf-8");

    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const content = fs.readFileSync(path.join(extDir, "index.ts"), "utf-8");
    expect(content).toBe(AUTO_INDEX_EXTENSION_TEMPLATE);
  });

  test("does not overwrite existing command files (user may have customized)", async () => {
    const cmdDir = path.join(tmpDir, ".omp", "commands");
    fs.mkdirSync(cmdDir, { recursive: true });
    const customContent = "---\ndescription: My custom index project\n---\nCustom command.";
    fs.writeFileSync(path.join(cmdDir, "index-project.md"), customContent, "utf-8");

    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const content = fs.readFileSync(path.join(cmdDir, "index-project.md"), "utf-8");
    expect(content).toBe(customContent);
  });
});

describe("setupOmp — idempotency", () => {
  test("running init twice produces no duplicates and no errors", async () => {
    const result1 = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });
    const result2 = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // mcp.json should have exactly one th0th entry
    const mcp = readJson(path.join(tmpDir, ".omp", "mcp.json")) as {
      servers: Record<string, unknown>;
    };
    const th0thEntries = Object.keys(mcp.servers).filter((k) => k === MCP_SERVER_KEY);
    expect(th0thEntries.length).toBe(1);

    // .gitignore should have exactly one entry for the extension
    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    const lines = gitignore.split("\n").filter((l) => l.trim() === ".omp/extensions/th0th-auto-index/");
    expect(lines.length).toBe(1);
  });
});

describe("setupOmp — .gitignore handling", () => {
  test("creates .gitignore if absent", async () => {
    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });
    expect(fs.existsSync(path.join(tmpDir, ".gitignore"))).toBe(true);
  });

  test("appends to existing .gitignore without disturbing other entries", async () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\ndist/\n", "utf-8");

    await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("dist/");
    expect(gitignore).toContain(".omp/extensions/th0th-auto-index/");
  });
});

describe("setupOmp — filesCreated tracking", () => {
  test("reports created files on first run", async () => {
    const result = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    expect(result.filesCreated.length).toBeGreaterThan(0);
    expect(result.filesCreated.some((f) => f.includes("mcp.json"))).toBe(true);
    expect(result.filesCreated.some((f) => f.includes("SKILL.md"))).toBe(true);
    expect(result.filesCreated.some((f) => f.includes("th0th-auto-index"))).toBe(true);
  });

  test("reports fewer created files on second run (idempotent)", async () => {
    const result1 = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });
    const result2 = await setupOmp({ projectRoot: tmpDir, skipGlobal: true });

    // On second run: mcp.json skipped (already has th0th), SKILL.md skipped, commands skipped
    // Only the extension is overwritten (not in filesCreated on second run)
    expect(result2.filesCreated.length).toBeLessThan(result1.filesCreated.length);
  });
});
