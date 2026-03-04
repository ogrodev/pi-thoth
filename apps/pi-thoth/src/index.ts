#!/usr/bin/env bun
/**
 * pi-thoth — Single-process MCP server
 *
 * Wires @th0th/core tool handlers directly into an MCP stdio server.
 * No HTTP, no separate tools-api process required.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { configExists, initConfig, getConfigForEnv } from "@th0th/shared/config";
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
// Auto-configure on first run
// ---------------------------------------------------------------------------
if (!configExists()) {
  initConfig();
  process.stderr.write(`
[pi-thoth] Initialized with default configuration.
[pi-thoth] Config: ~/.config/th0th/config.json
[pi-thoth] Provider: Ollama (local, free)
[pi-thoth] To change: bunx pi-thoth-config use mistral --api-key YOUR_KEY
`);
}

// Apply th0th config to process environment so core services pick it up.
const envOverrides = getConfigForEnv();
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
    process.stderr.write("[pi-thoth] MCP server running on stdio\n");
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
