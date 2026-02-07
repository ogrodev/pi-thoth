/**
 * Get Optimized Context Tool
 *
 * Busca código relevante + comprime semanticamente para economizar tokens.
 * Combina search_project + compress_context automaticamente.
 */

import { IToolHandler } from "@th0th/shared";
import { ToolResponse } from "@th0th/shared";
import { SearchProjectTool } from "./search_project.js";
import { CompressContextTool } from "./compress_context.js";
import { logger } from "@th0th/shared";
import { estimateTokens } from "@th0th/shared";

interface GetOptimizedContextParams {
  query: string;
  projectId: string;
  projectPath?: string;
  maxTokens?: number;
  maxResults?: number;
}

export class GetOptimizedContextTool implements IToolHandler {
  name = "get_optimized_context";
  description =
    "Retrieve and compress context with maximum token efficiency (search + compress)";
  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find relevant context",
      },
      projectId: {
        type: "string",
        description: "Project ID for code context",
      },
      projectPath: {
        type: "string",
        description: "Project path (for auto-reindex)",
      },
      maxTokens: {
        type: "number",
        description: "Maximum tokens in returned context",
        default: 4000,
      },
      maxResults: {
        type: "number",
        description: "Maximum search results to include",
        default: 5,
      },
    },
    required: ["query", "projectId"],
  };

  private searchTool: SearchProjectTool;
  private compressTool: CompressContextTool;

  constructor() {
    this.searchTool = new SearchProjectTool();
    this.compressTool = new CompressContextTool();
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const {
      query,
      projectId,
      projectPath,
      maxTokens = 4000,
      maxResults = 5,
    } = params as GetOptimizedContextParams;

    try {
      logger.info("Getting optimized context", {
        query: query.slice(0, 50),
        projectId,
        maxTokens,
      });

      // Step 1: Search for relevant code
      const searchResponse = await this.searchTool.handle({
        query,
        projectId,
        projectPath,
        maxResults,
        responseMode: "full", // Need full content for compression
        autoReindex: true,
        minScore: 0.4,
      });

      if (!searchResponse.success || !searchResponse.data) {
        return {
          success: false,
          error: "Failed to search code",
        };
      }

      // Step 2: Format search results into context
      const results = (searchResponse.data as any)?.results || [];

      if (results.length === 0) {
        return {
          success: true,
          data: {
            context: `No relevant code found for query: "${query}"`,
            sources: [],
          },
          metadata: {
            tokensSaved: 0,
            compressionRatio: 0,
            cacheHit: false,
          },
        };
      }

      const contextParts: string[] = [
        `# Context for: ${query}\n`,
        `Found ${results.length} relevant code sections:\n`,
      ];

      results.forEach((result: any, idx: number) => {
        contextParts.push(
          `## ${idx + 1}. ${result.filePath || "Unknown"} (score: ${(result.score * 100).toFixed(1)}%)`,
        );
        contextParts.push(`Lines ${result.lineStart}-${result.lineEnd}\n`);
        contextParts.push("```" + (result.language || ""));
        contextParts.push(result.content || result.preview || "(no content)");
        contextParts.push("```\n");
      });

      const rawContext = contextParts.join("\n");
      const rawTokens = estimateTokens(rawContext, "code");

      // Step 3: Compress if needed
      let finalContext = rawContext;
      let compressionRatio = 0;
      let tokensSaved = 0;

      if (rawTokens > maxTokens) {
        logger.info("Context exceeds maxTokens, compressing", {
          rawTokens,
          maxTokens,
        });

        const compressResponse = await this.compressTool.handle({
          content: rawContext,
          strategy: "code_structure",
          targetRatio: 0.6, // Compress to 40% of original
        });

        if (compressResponse.success && compressResponse.data) {
          finalContext = (compressResponse.data as any).compressed;
          compressionRatio = compressResponse.metadata?.compressionRatio || 0;
          tokensSaved = compressResponse.metadata?.tokensSaved || 0;
        }
      }

      const finalTokens = estimateTokens(finalContext, "code");

      logger.info("Optimized context retrieved", {
        rawTokens,
        finalTokens,
        tokensSaved: rawTokens - finalTokens,
        compressionRatio: compressionRatio || 0,
        sources: results.length,
      });

      return {
        success: true,
        data: {
          context: finalContext,
          sources: results.map((r: any) => r.filePath || "unknown"),
          resultsCount: results.length,
        },
        metadata: {
          tokensSaved: rawTokens - finalTokens,
          compressionRatio: compressionRatio || 0,
          cacheHit: false,
        } as any, // Allow extra metadata fields
      };
    } catch (error) {
      logger.error("Failed to get optimized context", error as Error, {
        query,
        projectId,
      });

      return {
        success: false,
        error: `Failed to retrieve context: ${(error as Error).message}`,
      };
    }
  }
}
