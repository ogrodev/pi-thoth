#!/usr/bin/env bun
/**
 * pi-thoth — Single-process MCP server
 *
 * Wires @th0th/core tool handlers directly into an MCP stdio server.
 * No HTTP, no separate tools-api process required.
 *
 * Requires a per-project .th0th/config.json — refuses to start without one.
 * Run `pi-thoth-config init` in the project directory to create it.
 */

import fs from "fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  projectConfigExists,
  getProjectDataDir,
  loadProjectConfig,
  configToEnv,
} from "@th0th/shared/config";
import { getTools, getTool } from "./tool-registry.js";

// ---------------------------------------------------------------------------
// Runtime guard — this package requires Bun for bun:sqlite used by core.
// ---------------------------------------------------------------------------
if (typeof Bun === "undefined") {
  process.stderr.write(
    "[pi-thoth] ERROR: Bun runtime required. Run via `bunx pi-thoth`, not `npx pi-thoth`.\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Per-project config guard — refuse to start without .th0th/config.json
// ---------------------------------------------------------------------------
const projectRoot = process.cwd();

if (!projectConfigExists(projectRoot)) {
  process.stderr.write(
    `[pi-thoth] No .th0th/config.json found in ${projectRoot}\n` +
      `[pi-thoth] Run \`pi-thoth-config init\` in your project directory first.\n`,
  );
  process.exit(1);
}

// Set TH0TH_DATA_DIR BEFORE any lazy Config.get() call resolves paths.
const projectDataDir = getProjectDataDir(projectRoot);
process.env.TH0TH_DATA_DIR = projectDataDir;

// Ensure the data directory exists (may have been deleted since init).
if (!fs.existsSync(projectDataDir)) {
  fs.mkdirSync(projectDataDir, { recursive: true });
}

// Load project config and propagate embedding/logging settings as env vars.
const projectConfig = loadProjectConfig(projectRoot);
const envOverrides = configToEnv(projectConfig);
for (const [key, value] of Object.entries(envOverrides)) {
  process.env[key] = value;
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------
class PiThothServer {
  private server: Server;
  private transport: StdioServerTransport;

  constructor() {
    this.server = new Server(
      { name: "pi-thoth", version: "1.0.2" },
      { capabilities: { tools: {} } },
    );
    this.transport = new StdioServerTransport();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools — pull name/description/inputSchema straight from core handlers.
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getTools().map(({ mcpName, handler }) => ({
          name: mcpName,
          description: handler.description,
          inputSchema: handler.inputSchema,
        })),
      };
    });

    // Call tool — delegate directly to core handler, no HTTP round-trip.
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const handler = getTool(name);
      if (!handler) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await handler.handle(args ?? {});

        // Core returns { success, data } or { success, error }.
        // When data is already a formatted string (TOON format), pass through directly.
        if (result.success && typeof result.data === "string") {
          return {
            content: [{ type: "text" as const, text: result.data }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !result.success,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    await this.server.connect(this.transport);
    process.stderr.write(
      `[pi-thoth] MCP server running on stdio\n` +
        `[pi-thoth] Project: ${projectRoot}\n` +
        `[pi-thoth] Data:    ${projectDataDir}\n`,
    );
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const server = new PiThothServer();

server.start().catch((err) => {
  process.stderr.write(`[pi-thoth] Failed to start: ${err}\n`);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});
