/**
 * Search Code Tool
 *
 * Alias para search_project com foco em busca semântica de código.
 * Usa os mesmos recursos de cache, auto-reindex e filtros.
 */

import { IToolHandler } from "@th0th/shared";
import { ToolResponse } from "@th0th/shared";
import { SearchProjectTool } from "./search_project.js";
import { logger } from "@th0th/shared";

interface SearchCodeParams {
  query: string;
  projectId: string;
  limit?: number;
}

export class SearchCodeTool implements IToolHandler {
  name = "search_code";
  description =
    "Search for code using semantic and keyword search (alias for search_project)";
  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Code search query (natural language or keywords)",
      },
      projectId: {
        type: "string",
        description: "Project ID to search in",
      },
      limit: {
        type: "number",
        description: "Maximum number of results",
        default: 10,
      },
    },
    required: ["query", "projectId"],
  };

  private searchProjectTool: SearchProjectTool;

  constructor() {
    this.searchProjectTool = new SearchProjectTool();
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const { query, projectId, limit = 10 } = params as SearchCodeParams;

    try {
      logger.info("Search code request", { query, projectId, limit });

      // Delegate to search_project with summary mode for token efficiency
      const response = await this.searchProjectTool.handle({
        query,
        projectId,
        maxResults: limit,
        responseMode: "summary", // Always use summary for code search
        autoReindex: false, // Don't auto-reindex on every code search
      });

      return response;
    } catch (error) {
      logger.error("Failed to search code", error as Error, {
        query,
        projectId,
      });

      return {
        success: false,
        error: `Failed to search code: ${(error as Error).message}`,
      };
    }
  }
}
