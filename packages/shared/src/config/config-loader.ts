import fs from "fs";
import path from "path";
import os from "os";
import { Th0thConfig, defaultTh0thConfig } from "./th0th-config";

// ---------------------------------------------------------------------------
// Global config (user template / defaults) — ~/.config/th0th/config.json
// ---------------------------------------------------------------------------

const CONFIG_DIR = path.join(os.homedir(), ".config", "th0th");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfig(): Th0thConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return defaultTh0thConfig;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const userConfig = JSON.parse(content);

    return {
      ...defaultTh0thConfig,
      ...userConfig,
      embedding: { ...defaultTh0thConfig.embedding, ...userConfig.embedding },
      compression: { ...defaultTh0thConfig.compression, ...userConfig.compression },
      cache: { ...defaultTh0thConfig.cache, ...userConfig.cache },
      logging: { ...defaultTh0thConfig.logging, ...userConfig.logging },
    };
  } catch (error) {
    console.error(`Error loading config from ${CONFIG_FILE}:`, error);
    return defaultTh0thConfig;
  }
}

export function saveConfig(config: Th0thConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function initConfig(): void {
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(defaultTh0thConfig);
    console.log(`Created default config at ${CONFIG_FILE}`);
  }
}

// ---------------------------------------------------------------------------
// Project config — <project-root>/.th0th/config.json
// ---------------------------------------------------------------------------

export function getProjectConfigDir(projectRoot: string): string {
  return path.join(projectRoot, ".th0th");
}

export function getProjectConfigPath(projectRoot: string): string {
  return path.join(projectRoot, ".th0th", "config.json");
}

export function getProjectDataDir(projectRoot: string): string {
  return path.join(projectRoot, ".th0th", "data");
}

export function projectConfigExists(projectRoot: string): boolean {
  return fs.existsSync(getProjectConfigPath(projectRoot));
}

export function loadProjectConfig(projectRoot: string): Th0thConfig {
  const projectPath = getProjectConfigPath(projectRoot);
  if (!fs.existsSync(projectPath)) {
    return { ...defaultTh0thConfig, dataDir: getProjectDataDir(projectRoot) };
  }

  try {
    const content = fs.readFileSync(projectPath, "utf-8");
    const projectConfig = JSON.parse(content);

    return {
      ...defaultTh0thConfig,
      ...projectConfig,
      embedding: { ...defaultTh0thConfig.embedding, ...projectConfig.embedding },
      compression: { ...defaultTh0thConfig.compression, ...projectConfig.compression },
      cache: { ...defaultTh0thConfig.cache, ...projectConfig.cache },
      logging: { ...defaultTh0thConfig.logging, ...projectConfig.logging },
      // Always derive dataDir from project root — never trust the stored value.
      dataDir: getProjectDataDir(projectRoot),
    };
  } catch (error) {
    console.error(`Error loading project config from ${projectPath}:`, error);
    return { ...defaultTh0thConfig, dataDir: getProjectDataDir(projectRoot) };
  }
}

export function saveProjectConfig(projectRoot: string, config: Th0thConfig): void {
  const configDir = getProjectConfigDir(projectRoot);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getProjectConfigPath(projectRoot), JSON.stringify(config, null, 2));
}

/**
 * Create .th0th/ directory structure and write config.json.
 * Uses the global config as a template if it exists; otherwise defaults.
 * Does NOT overwrite an existing project config.
 */
export function initProjectConfig(projectRoot: string): void {
  const configDir = getProjectConfigDir(projectRoot);
  const dataDir = getProjectDataDir(projectRoot);

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  if (!projectConfigExists(projectRoot)) {
    const template = configExists() ? loadConfig() : defaultTh0thConfig;
    const projectConfig: Th0thConfig = { ...template, dataDir };
    saveProjectConfig(projectRoot, projectConfig);
  }
}

// ---------------------------------------------------------------------------
// Environment variable mapping
// ---------------------------------------------------------------------------

/**
 * Convert a Th0thConfig to the environment variables consumed by core services.
 * Accepts any Th0thConfig instance (project or global).
 */
export function configToEnv(config: Th0thConfig): Record<string, string> {
  const env: Record<string, string> = {};

  if (config.embedding.provider === "ollama") {
    env.OLLAMA_EMBEDDING_MODEL = config.embedding.model;
    env.OLLAMA_BASE_URL = config.embedding.baseURL || "http://localhost:11434";
    if (config.embedding.dimensions) {
      env.OLLAMA_EMBEDDING_DIMENSIONS = String(config.embedding.dimensions);
    }
  } else if (config.embedding.provider === "mistral") {
    env.MISTRAL_API_KEY = config.embedding.apiKey || "";
    env.MISTRAL_TEXT_EMBEDDING_MODEL = config.embedding.model;
  } else if (config.embedding.provider === "openai") {
    env.OPENAI_API_KEY = config.embedding.apiKey || "";
    env.OPENAI_EMBEDDING_MODEL = config.embedding.model;
  }

  env.LOG_LEVEL = config.logging.level;
  env.ENABLE_METRICS = String(config.logging.enableMetrics);

  return env;
}

/**
 * Build env overrides from the global config file.
 * Kept for backward compatibility; prefer configToEnv(loadProjectConfig(root)).
 */
export function getConfigForEnv(): Record<string, string> {
  return configToEnv(loadConfig());
}
