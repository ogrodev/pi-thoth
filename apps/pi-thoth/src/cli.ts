#!/usr/bin/env bun
/**
 * pi-thoth-config — Setup and configuration CLI
 *
 * Commands:
 *   init              Bootstrap Ollama + create config
 *   show              Print current config
 *   set <key> <val>   Update a config field
 *   use <provider>    Switch embedding provider
 *   path              Print config file path
 *   help              Show this message
 */

import fs from "fs";
import path from "path";
import os from "os";
import {
  getConfigPath,
  configExists,
  loadConfig,
  saveConfig,
  initConfig,
  defaultTh0thConfig,
} from "@th0th/shared/config";
import { bootstrapOllama } from "./ollama-bootstrap.js";

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
  init              Bootstrap Ollama (install/start/pull model) and create config
    --ollama          Use Ollama (local, default)
    --mistral <key>   Use Mistral with API key (skips Ollama bootstrap)
    --openai <key>    Use OpenAI with API key (skips Ollama bootstrap)

  path              Print config file path
  show              Print current configuration (JSON)
  set <key> <val>   Set a configuration value (dot-notation supported)
  use <provider>    Switch embedding provider
    --api-key <key>   API key (required for mistral/openai)
    --model <name>    Model name (optional override)
    --base-url <url>  Base URL (for ollama)
  help              Show this message

Examples:
  pi-thoth-config init
  pi-thoth-config init --mistral your-api-key
  pi-thoth-config use ollama --model bge-m3:latest
  pi-thoth-config use mistral --api-key your-key
  pi-thoth-config set embedding.dimensions 1024
`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdInit(opts: Record<string, string | boolean>): Promise<void> {
  if (opts.mistral && typeof opts.mistral === "string") {
    // Remote Mistral — skip Ollama
    initConfig();
    const config = loadConfig();
    config.embedding = {
      provider: "mistral",
      model: "mistral-embed",
      apiKey: opts.mistral,
      dimensions: 1024,
    };
    saveConfig(config);
    console.log("Configured for Mistral embeddings.");
    console.log(`Config: ${getConfigPath()}`);
    return;
  }

  if (opts.openai && typeof opts.openai === "string") {
    // Remote OpenAI — skip Ollama
    initConfig();
    const config = loadConfig();
    config.embedding = {
      provider: "openai",
      model: "text-embedding-3-small",
      apiKey: opts.openai,
      dimensions: 1536,
    };
    saveConfig(config);
    console.log("Configured for OpenAI embeddings.");
    console.log(`Config: ${getConfigPath()}`);
    return;
  }

  // --- Local Ollama bootstrap ---
  const ollamaHost =
    process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const model =
    process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text:latest";

  console.log(`\npi-thoth setup\n${"─".repeat(40)}`);
  console.log(`[1/4] Bootstrapping Ollama (${model}) ...`);

  const bootstrap = await bootstrapOllama({ model, baseURL: ollamaHost });
  for (const msg of bootstrap.messages) {
    console.log(`      ${msg}`);
  }

  if (!bootstrap.success) {
    console.error("\nSetup failed. Fix the issue above and retry.");
    process.exit(1);
  }

  // [2/4] Create data directory
  console.log("[2/4] Creating data directory ...");
  const dataDir = path.join(os.homedir(), ".rlm");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  console.log(`      ${dataDir}`);

  // [3/4] Create config
  console.log("[3/4] Writing config ...");
  initConfig();
  const config = loadConfig();
  config.embedding = {
    provider: "ollama",
    model,
    baseURL: ollamaHost,
    dimensions: 768,
  };
  config.dataDir = dataDir;
  saveConfig(config);
  console.log(`      ${getConfigPath()}`);

  // [4/4] Verify
  console.log("[4/4] Verifying ...");
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
    { label: "Config file", ok: configExists() },
    {
      label: "Data directory",
      ok: fs.existsSync(dataDir) && fs.accessSync(dataDir, fs.constants.W_OK) === undefined,
    },
  ];

  for (const c of checks) {
    console.log(`      [${c.ok ? "OK" : "FAIL"}] ${c.label}`);
  }

  const allOk = checks.every((c) => c.ok);

  console.log(`\n${"─".repeat(40)}`);
  if (allOk) {
    console.log("Setup complete.\n");
    console.log("Next steps:");
    console.log('  Add to your editor config (e.g. opencode.json):');
    console.log('    "mcpServers": { "th0th": { "command": ["bunx", "pi-thoth"] } }');
    console.log(`\n  Config: ${getConfigPath()}`);
    console.log(`  Data:   ${dataDir}\n`);
  } else {
    console.error("Some checks failed. Review the output above.");
    process.exit(1);
  }
}

function cmdShow(): void {
  if (!configExists()) {
    console.log("No config file found. Run `pi-thoth-config init` first.");
    console.log("\nDefaults:");
    console.log(JSON.stringify(defaultTh0thConfig, null, 2));
    return;
  }
  console.log(JSON.stringify(loadConfig(), null, 2));
}

function cmdSet(key: string, value: string): void {
  if (!key || !value) {
    console.error("Usage: pi-thoth-config set <key> <value>");
    process.exit(1);
  }

  const config = loadConfig();
  const keys = key.split(".");
  let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]] as Record<string, unknown>;
  }

  const parsed = isNaN(Number(value)) ? value : Number(value);
  obj[keys[keys.length - 1]] = parsed;
  saveConfig(config);
  console.log(`Set ${key} = ${value}`);
}

function cmdUse(
  provider: string,
  opts: Record<string, string | boolean>,
): void {
  if (!provider || !["ollama", "mistral", "openai"].includes(provider)) {
    console.error("Provider must be: ollama, mistral, or openai");
    process.exit(1);
  }

  const config = loadConfig();

  if (provider === "ollama") {
    config.embedding = {
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
    config.embedding = {
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
    config.embedding = {
      provider: "openai",
      model: (opts.model as string) || "text-embedding-3-small",
      apiKey: opts["api-key"] as string,
      dimensions: 1536,
    };
  }

  saveConfig(config);
  console.log(`Switched to ${provider} embeddings.`);
  console.log(`  Model: ${config.embedding.model}`);
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
    console.log(getConfigPath());
    break;

  case "show":
    cmdShow();
    break;

  case "set": {
    const key = argv[1];
    const value = argv[2];
    cmdSet(key, value);
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
