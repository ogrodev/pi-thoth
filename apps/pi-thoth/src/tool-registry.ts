/**
 * Tool Registry
 *
 * Maps MCP-facing tool names to @th0th/core IToolHandler instances.
 * No HTTP involved — direct in-process invocation.
 */

import {
  IndexProjectTool,
  GetIndexStatusTool,
  SearchProjectTool,
  GetAnalyticsTool,
  GetOptimizedContextTool,
  CompressContextTool,
  StoreMemoryTool,
  SearchMemoriesTool,
} from "@th0th/core";
import type { IToolHandler } from "@th0th/shared";

export interface RegistryEntry {
  /** MCP-facing tool name (e.g. "th0th_search") */
  mcpName: string;
  handler: IToolHandler;
}

const entries: RegistryEntry[] = [
  { mcpName: "th0th_index", handler: new IndexProjectTool() },
  { mcpName: "th0th_index_status", handler: new GetIndexStatusTool() },
  { mcpName: "th0th_search", handler: new SearchProjectTool() },
  { mcpName: "th0th_remember", handler: new StoreMemoryTool() },
  { mcpName: "th0th_recall", handler: new SearchMemoriesTool() },
  { mcpName: "th0th_compress", handler: new CompressContextTool() },
  { mcpName: "th0th_optimized_context", handler: new GetOptimizedContextTool() },
  { mcpName: "th0th_analytics", handler: new GetAnalyticsTool() },
];

const byMcpName = new Map<string, RegistryEntry>(
  entries.map((e) => [e.mcpName, e]),
);

/** All registered tools. */
export function getTools(): RegistryEntry[] {
  return entries;
}

/**
 * Look up a tool by its MCP name.
 * Returns undefined for unknown names — callers must handle this.
 */
export function getTool(mcpName: string): IToolHandler | undefined {
  return byMcpName.get(mcpName)?.handler;
}
