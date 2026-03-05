/**
 * Configuration Management
 *
 * Centralized configuration for th0th Server
 *
 * Architecture:
 * - Global cache with projectId namespace (multi-tenant)
 * - All data isolated by project_id in the same SQLite database
 * - Optimized for multiple projects with embedding reuse
 */

import path from "path";
import os from "os";

export interface ServerConfig {
  // Server Info
  name: string;
  version: string;

  // Data Directory (global cache location)
  dataDir: string;

  // Cache Configuration (multi-tenant with projectId namespace)
  cache: {
    l1: {
      maxSize: number; // bytes
      defaultTTL: number; // seconds
    };
    l2: {
      dbPath: string;
      maxSize: number;
      defaultTTL: number;
    };
    embedding: {
      dbPath: string;
      maxAgeHours: number;
    };
  };

  // Vector Store Configuration (SQLite-based com embeddings)
  vectorStore: {
    type: "sqlite";
    dbPath: string;
    collectionName: string;
    embeddingModel?: string;
  };

  // Keyword Search Configuration
  keywordSearch: {
    dbPath: string;
    ftsVersion: "fts5";
  };

  // Compression Configuration
  compression: {
    defaultStrategy: string;
    minTokensForCompression: number;
    targetCompressionRatio: number; // 0-1
    llm: {
      enabled: boolean;
      baseUrl: string;
      apiKey: string;
      model: string;
      temperature: number;
      maxOutputTokens: number;
      timeoutMs: number;
      prompt?: string;
    };
  };

  // Rate Limiting
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };

  // Security
  security: {
    maxInputLength: number;
    sanitizeInputs: boolean;
    maxFileSize: number;
    maxIndexSize: number;
    allowedExtensions: string[];
    excludePatterns: string[];
  };

  // Logging
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableMetrics: boolean;
  };
}

/**
 * Get data directory.
 * Reads TH0TH_DATA_DIR env var first; falls back to ~/.rlm.
 * Called lazily so env overrides set before first config.get() are respected.
 */
function getDataDir(): string {
  return process.env.TH0TH_DATA_DIR || path.join(os.homedir(), ".rlm");
}

let _defaultConfig: ServerConfig | null = null;

/**
 * Default Configuration — lazy-initialized so TH0TH_DATA_DIR is
 * read after it has been set by the MCP server startup guard.
 */
function getDefaultConfig(): ServerConfig {
  if (!_defaultConfig) {
    const dataDir = getDataDir();
    _defaultConfig = {
      name: "th0th-server",
      version: "1.0.0",

      dataDir,

      cache: {
        l1: {
          maxSize: 100 * 1024 * 1024, // 100 MB
          defaultTTL: 300, // 5 minutes
        },
        l2: {
          dbPath: path.join(dataDir, "cache.db"),
          maxSize: 500 * 1024 * 1024, // 500 MB
          defaultTTL: 3600, // 1 hour
        },
        embedding: {
          dbPath: path.join(dataDir, "embedding-cache.db"),
          maxAgeHours: 168, // 7 days
        },
      },

      vectorStore: {
        type: "sqlite",
        dbPath: path.join(dataDir, "vector-store.db"),
        collectionName: "rlm_memories",
        embeddingModel: "default",
      },

      keywordSearch: {
        dbPath: path.join(dataDir, "keyword-search.db"),
        ftsVersion: "fts5",
      },

      compression: {
        defaultStrategy: "code_structure",
        minTokensForCompression: 100,
        targetCompressionRatio: 0.7, // 70% reduction
        llm: {
          enabled: process.env.RLM_LLM_ENABLED === "true",
          baseUrl: process.env.RLM_LLM_BASE_URL || "https://api.openai.com/v1",
          apiKey: process.env.RLM_LLM_API_KEY || "",
          model: process.env.RLM_LLM_MODEL || "gpt-4o-mini",
          temperature: Number(process.env.RLM_LLM_TEMPERATURE || "0.2"),
          maxOutputTokens: Number(process.env.RLM_LLM_MAX_OUTPUT_TOKENS || "800"),
          timeoutMs: Number(process.env.RLM_LLM_TIMEOUT_MS || "20000"),
          prompt: process.env.RLM_LLM_PROMPT || undefined,
        },
      },

      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000,
      },

      security: {
        maxInputLength: 100000,
        sanitizeInputs: true,
        maxIndexSize: 100000, // max files to index
        maxFileSize: 1024 * 1024, // 1MB per file
        allowedExtensions: [
          ".ts",
          ".js",
          ".tsx",
          ".jsx",
          ".py",
          ".java",
          ".go",
          ".rs",
          ".cpp",
          ".c",
          ".h",
          ".md",
          ".json",
          ".yaml",
          ".yml",
        ],
        excludePatterns: [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
          ".next/**",
          "coverage/**",
          "*.min.js",
          "*.min.css",
        ],
      },

      logging: {
        level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
        enableMetrics: process.env.ENABLE_METRICS === "true",
      },
    };
  }
  return _defaultConfig;
}

/**
 * Configuration Manager
 *
 * Lazy by default — paths are not resolved until first get() call,
 * which means TH0TH_DATA_DIR set by the MCP server startup guard
 * is always picked up correctly.
 */
export class Config {
  private _config: ServerConfig | null = null;

  constructor(overrides?: Partial<ServerConfig>) {
    if (overrides) {
      // Eagerly init only when explicit overrides are provided.
      this._config = this.mergeConfig(getDefaultConfig(), overrides);
      this.validate();
    }
    // Otherwise: lazy — computed on first get().
  }

  private ensureInit(): ServerConfig {
    if (!this._config) {
      this._config = this.mergeConfig(getDefaultConfig(), undefined);
      this.validate();
    }
    return this._config;
  }

  /**
   * Merge default config with overrides
   */
  private mergeConfig(
    defaults: ServerConfig,
    overrides?: Partial<ServerConfig>,
  ): ServerConfig {
    if (!overrides) return defaults;

    return {
      ...defaults,
      ...overrides,
      cache: {
        l1: { ...defaults.cache.l1, ...overrides.cache?.l1 },
        l2: { ...defaults.cache.l2, ...overrides.cache?.l2 },
        embedding: {
          ...defaults.cache.embedding,
          ...overrides.cache?.embedding,
        },
      },
      vectorStore: { ...defaults.vectorStore, ...overrides.vectorStore },
      keywordSearch: { ...defaults.keywordSearch, ...overrides.keywordSearch },
      compression: { ...defaults.compression, ...overrides.compression },
      rateLimit: { ...defaults.rateLimit, ...overrides.rateLimit },
      security: { ...defaults.security, ...overrides.security },
      logging: { ...defaults.logging, ...overrides.logging },
    };
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    const cfg = this._config!;
    if (
      cfg.compression.targetCompressionRatio < 0 ||
      cfg.compression.targetCompressionRatio > 1
    ) {
      throw new Error("targetCompressionRatio must be between 0 and 1");
    }
  }

  /**
   * Get configuration value
   */
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.ensureInit()[key];
  }

  /**
   * Get nested configuration value
   */
  getNested(path: string): any {
    return path.split(".").reduce((obj: any, key) => obj?.[key], this.ensureInit());
  }

  /**
   * Get all configuration
   */
  getAll(): ServerConfig {
    return { ...this.ensureInit() };
  }

  /**
   * Update configuration (runtime)
   */
  set<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]): void {
    this.ensureInit()[key] = value;
  }
}

/**
 * Global config instance
 */
export const config = new Config();

export {
  Th0thConfig,
  defaultTh0thConfig,
  configExamples,
} from "./th0th-config";

export {
  getConfigDir,
  getConfigPath,
  configExists,
  loadConfig,
  saveConfig,
  initConfig,
  getConfigForEnv,
  getProjectConfigDir,
  getProjectConfigPath,
  getProjectDataDir,
  projectConfigExists,
  loadProjectConfig,
  saveProjectConfig,
  initProjectConfig,
  configToEnv,
} from "./config-loader";
