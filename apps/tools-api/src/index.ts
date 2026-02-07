#!/usr/bin/env bun
/**
 * th0th Tools API
 *
 * API REST com ElysiaJS que expõe todas as ferramentas do th0th.
 * Separada do protocolo MCP para permitir múltiplos clientes.
 */

import "@th0th/shared/config";

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { searchRoutes } from "./routes/search.js";
import { memoryRoutes } from "./routes/memory.js";
import { projectRoutes } from "./routes/project.js";
import { contextRoutes } from "./routes/context.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";

const PORT = process.env.TH0TH_API_PORT || 3333;

const app = new Elysia({ adapter: node() })
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "th0th Tools API",
          version: "1.0.0",
          description:
            "API de ferramentas de contexto semântico, memória e busca de código. Consumida pelo MCP Client e outros clientes.",
        },
        tags: [
          { name: "search", description: "Busca semântica e por keywords" },
          { name: "memory", description: "Armazenamento e busca de memórias" },
          { name: "project", description: "Indexação de projetos" },
          {
            name: "context",
            description: "Compressão e otimização de contexto",
          },
          { name: "analytics", description: "Métricas e analytics" },
        ],
      },
    }),
  )
  .use(errorHandler)
  .use(authMiddleware)
  .use(searchRoutes)
  .use(memoryRoutes)
  .use(projectRoutes)
  .use(contextRoutes)
  .use(analyticsRoutes)
  .get("/health", () => ({
    status: "ok",
    service: "th0th-tools-api",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }))
  .listen(PORT);

console.log(`th0th Tools API running at http://localhost:${PORT}`);
console.log(`Swagger docs at http://localhost:${PORT}/swagger`);

export type App = typeof app;
