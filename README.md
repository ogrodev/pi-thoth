<img src="https://i.imgur.com/5EJK9OF.png" alt="th0th" style="visibility: visible; max-width: 60%; display: block; margin: 0 auto;" />

# pi-thoth

**Semantic search, persistent memory, and context compression for AI assistants**

Single-process MCP server. No separate API server. No Docker required.

---

## Quick Start

```bash
# 1. Setup — install Ollama, start it, pull model, create config
bunx pi-thoth-config init

# 2. Add to your editor MCP config
#    "mcpServers": { "th0th": { "command": ["bunx", "pi-thoth"] } }
```

That's it. The server starts on stdio, calls core directly.

---

## Editor Integration

### Oh My Pi

```json
{
  "mcpServers": {
    "th0th": {
      "command": ["bunx", "pi-thoth"],
      "enabled": true
    }
  }
}
```

### Any MCP-compatible editor

```json
{
  "mcpServers": {
    "th0th": {
      "command": ["bunx", "pi-thoth"]
    }
  }
}
```

---

## Tools

| Tool | Description |
|------|-------------|
| `th0th_index` | Index a project directory for semantic search |
| `th0th_index_status` | Check status of a background indexing job |
| `th0th_search` | Hybrid vector + keyword search with RRF ranking |
| `th0th_remember` | Store information in persistent memory (SQLite) |
| `th0th_recall` | Search stored memories from previous sessions |
| `th0th_compress` | Compress context (keeps structure, removes details) |
| `th0th_optimized_context` | Search + memory + compress in one call |
| `th0th_analytics` | Usage patterns and cache performance metrics |

---

## Configuration

Config file: `~/.config/th0th/config.json` (created on first run)

```bash
bunx pi-thoth-config init                        # Ollama (local, default)
bunx pi-thoth-config init --mistral your-key     # Mistral
bunx pi-thoth-config init --openai your-key      # OpenAI
bunx pi-thoth-config show                        # Print current config
bunx pi-thoth-config set embedding.model bge-m3:latest
bunx pi-thoth-config use ollama --model bge-m3:latest
```

### Embedding providers

| Provider | Model | Cost | Quality |
|----------|-------|------|---------|
| **Ollama** (default) | nomic-embed-text | Free | Good |
| **Mistral** | mistral-embed | Paid | Great |
| **OpenAI** | text-embedding-3-small | Paid | Great |

---

## From Source

```bash
git clone <repo-url>
cd th0th
bun install
./scripts/setup-local-first.sh   # Ollama + model + config
bun run build
```

---

## Architecture

```
Editor/agent (stdio)
       |
  apps/pi-thoth          Single-process MCP server + CLI
       |
  packages/core          Search, memory, compression, embeddings
       |
  packages/shared        Config, types, utilities
       |
   ~/.rlm/*.db           SQLite databases (auto-created)
```

| Component | Description |
|-----------|-------------|
| **Semantic Search** | Hybrid vector + keyword with RRF ranking |
| **Embeddings** | Ollama (local) or Mistral/OpenAI API |
| **Compression** | Rule-based code structure extraction (70-98% reduction) |
| **Memory** | Persistent SQLite storage across sessions |
| **Cache** | Multi-level L1/L2 with TTL |

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Build all packages |
| `bun run dev:mcp` | Run pi-thoth with hot reload |
| `bun run start` | Start pi-thoth MCP server |
| `bun run test` | Run tests |
| `bun run type-check` | Type checking |

---

## License

MIT
