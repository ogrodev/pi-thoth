/**
 * Memory Routes
 *
 * POST /api/v1/memory/store  - Armazenar memória
 * POST /api/v1/memory/search - Buscar memórias
 */

import { Elysia, t } from "elysia";
import { StoreMemoryTool, SearchMemoriesTool } from "@th0th/core";

const storeMemoryTool = new StoreMemoryTool();
const searchMemoriesTool = new SearchMemoriesTool();

export const memoryRoutes = new Elysia({ prefix: "/api/v1/memory" })
  .post(
    "/store",
    async ({ body }) => {
      return await storeMemoryTool.handle(body);
    },
    {
      body: t.Object({
        content: t.String({ description: "Content to store in memory" }),
        type: t.Union(
          [
            t.Literal("preference"),
            t.Literal("conversation"),
            t.Literal("code"),
            t.Literal("decision"),
            t.Literal("pattern"),
          ],
          { description: "Type of memory" },
        ),
        userId: t.Optional(t.String()),
        projectId: t.Optional(t.String()),
        sessionId: t.Optional(t.String()),
        agentId: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        importance: t.Optional(
          t.Number({ minimum: 0, maximum: 1, default: 0.5 }),
        ),
        format: t.Optional(
          t.Union([t.Literal("json"), t.Literal("toon")], { default: "toon" }),
        ),
      }),
      detail: {
        tags: ["memory"],
        summary: "Store memory",
        description:
          "Store a new memory in the hierarchical memory system (local SQLite)",
      },
    },
  )
  .post(
    "/search",
    async ({ body }) => {
      return await searchMemoriesTool.handle(body);
    },
    {
      body: t.Object({
        query: t.String({ description: "Search query (what to remember)" }),
        userId: t.Optional(t.String()),
        projectId: t.Optional(t.String()),
        sessionId: t.Optional(t.String()),
        agentId: t.Optional(t.String()),
        types: t.Optional(
          t.Array(
            t.Union([
              t.Literal("preference"),
              t.Literal("conversation"),
              t.Literal("code"),
              t.Literal("decision"),
              t.Literal("pattern"),
            ]),
          ),
        ),
        limit: t.Optional(t.Number({ default: 10 })),
        minImportance: t.Optional(
          t.Number({ minimum: 0, maximum: 1, default: 0.3 }),
        ),
        includePersistent: t.Optional(t.Boolean({ default: true })),
        format: t.Optional(
          t.Union([t.Literal("json"), t.Literal("toon")], { default: "toon" }),
        ),
      }),
      detail: {
        tags: ["memory"],
        summary: "Search memories",
        description:
          "Search stored memories using semantic search across sessions",
      },
    },
  );
