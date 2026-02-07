/**
 * Index Project Tool
 *
 * Indexa um projeto inteiro para busca contextual otimizada.
 * Cria embeddings e índices FTS5 para todos os arquivos relevantes.
 */

import { IToolHandler } from "@th0th/shared";
import { ToolResponse } from "@th0th/shared";
import { ContextualSearchRLM } from "../services/search/contextual-search-rlm.js";
import { logger } from "@th0th/shared";
import path from "path";

interface IndexProjectParams {
  projectPath: string;
  projectId?: string;
  forceReindex?: boolean;
  warmCache?: boolean;
  warmupQueries?: string[];
}

export class IndexProjectTool implements IToolHandler {
  name = "index_project";
  description =
    "Index a project directory for contextual code search with semantic embeddings";
  inputSchema = {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "Absolute path to the project directory to index",
      },
      projectId: {
        type: "string",
        description:
          "Unique identifier for the project (defaults to directory name)",
      },
      forceReindex: {
        type: "boolean",
        description: "Force reindex even if project already exists",
        default: false,
      },
      warmCache: {
        type: "boolean",
        description: "Pre-cache common queries after indexing for faster initial searches",
        default: false,
      },
      warmupQueries: {
        type: "array",
        items: { type: "string" },
        description: "Custom queries to pre-cache (uses defaults if not provided)",
      },
    },
    required: ["projectPath"],
  };

  private contextualSearch: ContextualSearchRLM;

  constructor() {
    this.contextualSearch = new ContextualSearchRLM();
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const {
      projectPath,
      projectId,
      forceReindex = false,
      warmCache = false,
      warmupQueries,
    } = params as IndexProjectParams;

    try {
      // Gera projectId se não fornecido
      const finalProjectId =
        projectId || path.basename(projectPath) || "default";

      logger.info("Starting project indexing", {
        projectPath,
        projectId: finalProjectId,
        forceReindex,
        warmCache,
      });

      // Se forceReindex, limpa indexação anterior
      if (forceReindex) {
        await this.contextualSearch.clearProjectIndex(finalProjectId);
        logger.info("Cleared previous project index", {
          projectId: finalProjectId,
        });
      }

      // Indexa o projeto
      const stats = await this.contextualSearch.indexProject(
        projectPath,
        finalProjectId,
      );

      logger.info("Project indexing completed", {
        projectId: finalProjectId,
        ...stats,
      });

      // Warmup cache if requested
      let warmupStats = null;
      if (warmCache) {
        logger.info("Starting cache warmup", { projectId: finalProjectId });
        warmupStats = await this.contextualSearch.warmupCache(
          finalProjectId,
          projectPath,
          warmupQueries,
        );
        logger.info("Cache warmup completed", {
          projectId: finalProjectId,
          ...warmupStats,
        });
      }

      return {
        success: true,
        data: {
          projectId: finalProjectId,
          ...stats,
          ...(warmupStats && { warmup: warmupStats }),
        },
      };
    } catch (error) {
      logger.error("Failed to index project", error as Error, {
        projectPath,
        projectId,
      });

      return {
        success: false,
        error: `Failed to index project: ${(error as Error).message}`,
      };
    }
  }
}
