/**
 * Project Routes
 *
 * POST /api/v1/project/index - Indexar projeto
 */

import { Elysia, t } from "elysia";
import { IndexProjectTool } from "@th0th/core";

const indexProjectTool = new IndexProjectTool();

export const projectRoutes = new Elysia({ prefix: "/api/v1/project" }).post(
  "/index",
  async ({ body }) => {
    return await indexProjectTool.handle(body);
  },
  {
    body: t.Object({
      projectPath: t.String({
        description: "Absolute path to the project directory to index",
      }),
      projectId: t.Optional(
        t.String({ description: "Unique identifier for the project" }),
      ),
      forceReindex: t.Optional(t.Boolean({ default: false })),
      warmCache: t.Optional(
        t.Boolean({
          default: false,
          description: "Pre-cache common queries after indexing",
        }),
      ),
      warmupQueries: t.Optional(
        t.Array(t.String(), { description: "Custom queries to pre-cache" }),
      ),
    }),
    detail: {
      tags: ["project"],
      summary: "Index a project",
      description:
        "Index a project directory for contextual code search with semantic embeddings",
    },
  },
);
