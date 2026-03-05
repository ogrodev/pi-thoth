#!/usr/bin/env bun
/**
 * pi-thoth-config — Setup and configuration CLI
 *
 * Commands:
 *   init              Bootstrap Ollama + create per-project .th0th/config.json
 *     --global          Write global template instead (~/.config/th0th/config.json)
 *     --ollama          Use Ollama (local, default)
 *     --mistral <key>   Use Mistral with API key (skips Ollama bootstrap)
 *     --openai <key>    Use OpenAI with API key (skips Ollama bootstrap)
 *   show              Print project config (falls back to global)
 *   set <key> <val>   Update a config field (project or --global)
 *   use <provider>    Switch embedding provider (project or --global)
 *   path              Print config file path (project or global)
 *   help              Show this message
 */

import fs from "fs";
import path from "path";
import {
  getConfigPath,
  configExists,
  loadConfig,
  saveConfig,
  initConfig,
  getProjectConfigPath,
  getProjectDataDir,
  projectConfigExists,
  loadProjectConfig,
  saveProjectConfig,
  initProjectConfig,
  defaultTh0thConfig,
} from "@th0th/shared/config";
import { bootstrapOllama } from "./ollama-bootstrap.js";
import { setupOmp } from "./omp-setup.js";
import { ensureGlobalConfig } from "./global-config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOptions(args: string[]): Record<string, string | boolean> {
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        opts[key] = args[i + 1];
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`
pi-thoth-config — configuration manager for pi-thoth

Usage:
  pi-thoth-config <command> [options]

Commands:
  init              Create .th0th/config.json in the current project directory
    --global          Write global template to ~/.config/th0th/config.json instead
    --ollama          Use Ollama (local, default)
    --mistral <key>   Use Mistral with API key (skips Ollama bootstrap)
    --openai <key>    Use OpenAI with API key (skips Ollama bootstrap)
    --omp             Also configure .omp/ oh-my-pi integration (MCP, skills, commands)
    --skip-global     With --omp: skip ~/.omp/agent/config.yml modifications

  path              Print active config file path (project, or global if no project)
  show              Print active configuration (JSON)
  set <key> <val>   Set a configuration value (dot-notation, project by default)
    --global          Apply to global config instead
  use <provider>    Switch embedding provider (project by default)
    --global          Apply to global config instead
    --api-key <key>   API key (required for mistral/openai)
    --model <name>    Model name (optional override)
    --base-url <url>  Base URL (for ollama)
  help              Show this message

Examples:
  pi-thoth-config init
  pi-thoth-config init --omp
  pi-thoth-config init --omp --skip-global
  pi-thoth-config init --mistral your-api-key
  pi-thoth-config init --global
  pi-thoth-config use ollama --model bge-m3:latest
  pi-thoth-config use mistral --api-key your-key
  pi-thoth-config set embedding.dimensions 1024
  pi-thoth-config set embedding.dimensions 1024 --global
`);
}

/**
 * Append `.th0th/` to the project's .gitignore if not already present.
 */
function ensureGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const entry = ".th0th/";

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (content.split("\n").some((l) => l.trim() === entry)) {
      return; // already present
    }
    fs.appendFileSync(gitignorePath, `\n# pi-thoth per-project config and data\n${entry}\n`);
  } else {
    fs.writeFileSync(gitignorePath, `# pi-thoth per-project config and data\n${entry}\n`);
  }
  console.log(`      Added ${entry} to .gitignore`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdInit(opts: Record<string, string | boolean>): Promise<void> {
  const isGlobal = Boolean(opts.global);

  if (isGlobal) {
    await cmdInitGlobal(opts);
    return;
  }

  await cmdInitProject(opts);
}

async function cmdInitGlobal(opts: Record<string, string | boolean>): Promise<void> {
  console.log(`\npi-thoth global setup\n${"─".repeat(40)}`);

  if (opts.mistral && typeof opts.mistral === "string") {
    initConfig();
    const cfg = loadConfig();
    cfg.embedding = {
      provider: "mistral",
      model: "mistral-embed",
      apiKey: opts.mistral,
      dimensions: 1024,
    };
    saveConfig(cfg);
    console.log("Configured global template for Mistral embeddings.");
    console.log(`Config: ${getConfigPath()}`);
    return;
  }

  if (opts.openai && typeof opts.openai === "string") {
    initConfig();
    const cfg = loadConfig();
    cfg.embedding = {
      provider: "openai",
      model: "text-embedding-3-small",
      apiKey: opts.openai,
      dimensions: 1536,
    };
    saveConfig(cfg);
    console.log("Configured global template for OpenAI embeddings.");
    console.log(`Config: ${getConfigPath()}`);
    return;
  }

  // Ollama bootstrap
  const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text:latest";
  const withOmp = Boolean(opts["omp"]);
  const globalTotal = withOmp ? 4 : 3;

  console.log(`[1/${globalTotal}] Bootstrapping Ollama (${model}) ...`);
  const bootstrap = await bootstrapOllama({ model, baseURL: ollamaHost });
  for (const msg of bootstrap.messages) {
    console.log(`      ${msg}`);
  }

  if (!bootstrap.success) {
    console.error("\nSetup failed. Fix the issue above and retry.");
    process.exit(1);
  }

  console.log(`[2/${globalTotal}] Writing global config ...`);
  initConfig();
  const cfg = loadConfig();
  cfg.embedding = {
    provider: "ollama",
    model,
    baseURL: ollamaHost,
    dimensions: 768,
  };
  saveConfig(cfg);
  console.log(`      ${getConfigPath()}`);

  console.log(`[3/${globalTotal}] Verifying ...`);
  const checks = [
    {
      label: "Ollama API",
      ok: await (async () => {
        try {
          const r = await fetch(`${ollamaHost}/api/tags`, {
            signal: AbortSignal.timeout(5000),
          });
          return r.ok;
        } catch {
          return false;
        }
      })(),
    },
    { label: "Global config file", ok: configExists() },
  ];
  for (const c of checks) {
    console.log(`      [${c.ok ? "OK" : "FAIL"}] ${c.label}`);
  }

  if (withOmp) {
    console.log(`[4/${globalTotal}] Configuring ~/.omp/ global integration ...`);
    const globalResult = await ensureGlobalConfig();
    for (const msg of globalResult.messages) {
      console.log(`      ${msg}`);
    }
  }

  console.log(`\n${"\u2500".repeat(40)}`);
  if (checks.every((c) => c.ok)) {
    console.log("Global config ready.\n");
    console.log(`  Config: ${getConfigPath()}`);
    console.log(`\n  Run \`pi-thoth-config init\` inside a project to create .th0th/config.json\n`);
  } else {
    console.error("Some checks failed. Review the output above.");
    process.exit(1);
  }
}

async function cmdInitProject(opts: Record<string, string | boolean>): Promise<void> {
  const projectRoot = process.cwd();
  const dataDir = getProjectDataDir(projectRoot);
  const configPath = getProjectConfigPath(projectRoot);
  const withOmp = Boolean(opts["omp"]);
  const totalSteps = withOmp ? 5 : 4;

  console.log(`\npi-thoth setup\n${"─".repeat(40)}`);
  console.log(`Project: ${projectRoot}`);

  if (opts.mistral && typeof opts.mistral === "string") {
    console.log("Creating project config (Mistral) ...");
    initProjectConfig(projectRoot);
    const cfg = loadProjectConfig(projectRoot);
    cfg.embedding = {
      provider: "mistral",
      model: "mistral-embed",
      apiKey: opts.mistral,
      dimensions: 1024,
    };
    saveProjectConfig(projectRoot, cfg);
    ensureGitignore(projectRoot);
    console.log(`      ${configPath}`);

    if (withOmp) {
      console.log("Setting up .omp/ integration ...");
      const ompResult = await setupOmp({
        projectRoot,
        skipGlobal: Boolean(opts["skip-global"]),
      });
      for (const msg of ompResult.messages) {
        console.log(`      ${msg}`);
      }
    }

    console.log("\nSetup complete.\n");
    console.log("  Config: " + configPath);
    console.log(`  Data:   ${dataDir}\n`);
    return;
  }

  if (opts.openai && typeof opts.openai === "string") {
    console.log("Creating project config (OpenAI) ...");
    initProjectConfig(projectRoot);
    const cfg = loadProjectConfig(projectRoot);
    cfg.embedding = {
      provider: "openai",
      model: "text-embedding-3-small",
      apiKey: opts.openai,
      dimensions: 1536,
    };
    saveProjectConfig(projectRoot, cfg);
    ensureGitignore(projectRoot);
    console.log(`      ${configPath}`);

    if (withOmp) {
      console.log("Setting up .omp/ integration ...");
      const ompResult = await setupOmp({
        projectRoot,
        skipGlobal: Boolean(opts["skip-global"]),
      });
      for (const msg of ompResult.messages) {
        console.log(`      ${msg}`);
      }
    }

    console.log("\nSetup complete.\n");
    console.log("  Config: " + configPath);
    console.log(`  Data:   ${dataDir}\n`);
    return;
  }

  // --- Local Ollama bootstrap ---
  const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text:latest";

  console.log(`[1/${totalSteps}] Bootstrapping Ollama (${model}) ...`);
  const bootstrap = await bootstrapOllama({ model, baseURL: ollamaHost });
  for (const msg of bootstrap.messages) {
    console.log(`      ${msg}`);
  }

  if (!bootstrap.success) {
    console.error("\nSetup failed. Fix the issue above and retry.");
    process.exit(1);
  }

  console.log(`[2/${totalSteps}] Creating .th0th/ directory structure ...`);
  initProjectConfig(projectRoot);
  const cfg = loadProjectConfig(projectRoot);
  cfg.embedding = {
    provider: "ollama",
    model,
    baseURL: ollamaHost,
    dimensions: 768,
  };
  saveProjectConfig(projectRoot, cfg);
  console.log(`      ${configPath}`);
  console.log(`      ${dataDir}`);

  console.log(`[3/${totalSteps}] Updating .gitignore ...`);
  ensureGitignore(projectRoot);

  if (withOmp) {
    console.log(`[4/${totalSteps}] Setting up .omp/ integration ...`);
    const ompResult = await setupOmp({
      projectRoot,
      skipGlobal: Boolean(opts["skip-global"]),
    });
    for (const msg of ompResult.messages) {
      console.log(`      ${msg}`);
    }
  }

  console.log(`[${totalSteps}/${totalSteps}] Verifying ...`);
  const checks = [
    {
      label: "Ollama API",
      ok: await (async () => {
        try {
          const r = await fetch(`${ollamaHost}/api/tags`, {
            signal: AbortSignal.timeout(5000),
          });
          return r.ok;
        } catch {
          return false;
        }
      })(),
    },
    { label: "Project config", ok: projectConfigExists(projectRoot) },
    {
      label: "Data directory",
      ok: (() => {
        if (!fs.existsSync(dataDir)) {
          try {
            fs.mkdirSync(dataDir, { recursive: true });
          } catch {
            return false;
          }
        }
        try {
          fs.accessSync(dataDir, fs.constants.W_OK);
          return true;
        } catch {
          return false;
        }
      })(),
    },
  ];
  for (const c of checks) {
    console.log(`      [${c.ok ? "OK" : "FAIL"}] ${c.label}`);
  }

  const allOk = checks.every((c) => c.ok);

  console.log(`\n${"\u2500".repeat(40)}`);
  if (allOk) {
    console.log("Setup complete.\n");
    console.log("  Config: " + configPath);
    console.log(`  Data:   ${dataDir}\n`);
  } else {
    console.error("Some checks failed. Review the output above.");
    process.exit(1);
  }
}

function cmdShow(opts: Record<string, string | boolean>): void {
  const projectRoot = process.cwd();
  const isGlobal = Boolean(opts.global);

  if (!isGlobal && projectConfigExists(projectRoot)) {
    console.log(JSON.stringify(loadProjectConfig(projectRoot), null, 2));
    return;
  }

  if (!configExists()) {
    console.log("No config file found. Run `pi-thoth-config init` first.");
    console.log("\nDefaults:");
    console.log(JSON.stringify(defaultTh0thConfig, null, 2));
    return;
  }

  console.log(JSON.stringify(loadConfig(), null, 2));
}

function cmdPath(opts: Record<string, string | boolean>): void {
  const projectRoot = process.cwd();
  const isGlobal = Boolean(opts.global);

  if (!isGlobal && projectConfigExists(projectRoot)) {
    console.log(getProjectConfigPath(projectRoot));
    return;
  }

  console.log(getConfigPath());
}

function cmdSet(key: string, value: string, opts: Record<string, string | boolean>): void {
  if (!key || !value) {
    console.error("Usage: pi-thoth-config set <key> <value> [--global]");
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const isGlobal = Boolean(opts.global);

  if (!isGlobal && projectConfigExists(projectRoot)) {
    const cfg = loadProjectConfig(projectRoot);
    setNestedKey(cfg as Record<string, unknown>, key, value);
    saveProjectConfig(projectRoot, cfg);
    console.log(`Set ${key} = ${value} (project)`);
    return;
  }

  if (isGlobal) {
    const cfg = loadConfig();
    setNestedKey(cfg as Record<string, unknown>, key, value);
    saveConfig(cfg);
    console.log(`Set ${key} = ${value} (global)`);
    return;
  }

  console.error("No project config found. Run `pi-thoth-config init` first.");
  console.error("Use --global to update the global template instead.");
  process.exit(1);
}

function cmdUse(
  provider: string,
  opts: Record<string, string | boolean>,
): void {
  if (!provider || !["ollama", "mistral", "openai"].includes(provider)) {
    console.error("Provider must be: ollama, mistral, or openai");
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const isGlobal = Boolean(opts.global);

  const useProject = !isGlobal && projectConfigExists(projectRoot);

  if (!useProject && !isGlobal) {
    console.error("No project config found. Run `pi-thoth-config init` first.");
    console.error("Use --global to update the global template instead.");
    process.exit(1);
  }

  const cfg = useProject ? loadProjectConfig(projectRoot) : loadConfig();

  if (provider === "ollama") {
    cfg.embedding = {
      provider: "ollama",
      model: (opts.model as string) || "nomic-embed-text:latest",
      baseURL: (opts["base-url"] as string) || "http://localhost:11434",
      dimensions: 768,
    };
  } else if (provider === "mistral") {
    if (!opts["api-key"]) {
      console.error("--api-key required for Mistral");
      process.exit(1);
    }
    cfg.embedding = {
      provider: "mistral",
      model: (opts.model as string) || "mistral-embed",
      apiKey: opts["api-key"] as string,
      dimensions: 1024,
    };
  } else if (provider === "openai") {
    if (!opts["api-key"]) {
      console.error("--api-key required for OpenAI");
      process.exit(1);
    }
    cfg.embedding = {
      provider: "openai",
      model: (opts.model as string) || "text-embedding-3-small",
      apiKey: opts["api-key"] as string,
      dimensions: 1536,
    };
  }

  if (useProject) {
    saveProjectConfig(projectRoot, cfg);
    console.log(`Switched to ${provider} embeddings (project).`);
  } else {
    saveConfig(cfg);
    console.log(`Switched to ${provider} embeddings (global).`);
  }
  console.log(`  Model: ${cfg.embedding.model}`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function setNestedKey(
  obj: Record<string, unknown>,
  key: string,
  value: string,
): void {
  const keys = key.split(".");
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cursor = cursor[keys[i]] as Record<string, unknown>;
  }
  const parsed = isNaN(Number(value)) ? value : Number(value);
  cursor[keys[keys.length - 1]] = parsed;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const command = argv[0];
const opts = parseOptions(argv.slice(1));

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

switch (command) {
  case "init":
    await cmdInit(opts);
    break;

  case "path":
    cmdPath(opts);
    break;

  case "show":
    cmdShow(opts);
    break;

  case "set": {
    const key = argv[1];
    const value = argv[2];
    cmdSet(key, value, opts);
    break;
  }

  case "use": {
    const provider = argv[1];
    cmdUse(provider, opts);
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
