# 🏛️ th0th MCP - Clean Refactored Version

**Ancient knowledge keeper for modern code**

This is the **clean, refactored version** of th0th MCP server, containing only the modern monorepo structure without legacy code.

---

## 📁 Project Structure

```
th0thMCP/
├── apps/
│   ├── mcp-client/        # MCP Protocol Server (stdio)
│   │   └── dist/index.js  # Built MCP server
│   └── tools-api/         # REST API (port 3333)
│       └── dist/index.js  # Built API server
├── packages/
│   ├── core/              # Core business logic
│   │   ├── services/      # Search, cache, embeddings, compression
│   │   ├── models/        # Data models
│   │   └── tools/         # MCP tool implementations
│   └── shared/            # Shared utilities, types, config
├── docs/                  # Documentation
├── test_final_integration.mjs
├── package.json           # Monorepo root config
└── turbo.json             # Turborepo configuration
```

### 🗑️ What was removed?

The old `/projetos/th0th` contained legacy code in `src/` that was replaced by the monorepo structure. This clean version **only contains**:
- ✅ `apps/` - Modern application structure
- ✅ `packages/` - Modular core packages
- ✅ Documentation and tests
- ❌ Old `src/` directory (removed)
- ❌ Legacy server files (removed)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /home/joaov/projetos/th0thMCP
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Build

```bash
bun run build
```

### 4. Start API Server (Required!)

```bash
bun run start:api
# API runs on http://localhost:3333
```

### 5. Configure OpenCode

Location: `/home/joaov/.config/opencode/opencode.json`

```json
{
  "th0th": {
    "type": "local",
    "command": [
      "bun",
      "run",
      "/home/joaov/projetos/th0thMCP/apps/mcp-client/dist/index.js"
    ],
    "environment": {
      "MISTRAL_API_KEY": "your-key",
      "RLM_LLM_ENABLED": "true"
    },
    "enabled": true
  }
}
```

---

## 🧪 Testing

```bash
node test_final_integration.mjs
# Expected: 7/7 tests passing
```

---

## 📚 Documentation

- **COMPLETION_SUMMARY.md** - Implementation summary
- **docs/** - Detailed documentation

---

🏛️ **th0th** - 98.7% token reduction for AI assistants
