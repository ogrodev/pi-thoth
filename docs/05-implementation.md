# Guia de Implementação

## 1. Pré-requisitos

### 1.1 Software Necessário (Core)

- **Node.js** 18+ ou **Bun** 1.0+
- **Git**
- **Ollama** (opcional, para embeddings locais)

### 1.2 Contas e API Keys (Opcionais)

- **Mem0.ai**: Crie conta em [app.mem0.ai](https://app.mem0.ai) - **OPCIONAL**
- **OpenAI** (opcional): Para modelos GPT
- **Anthropic** (opcional): Para modelos Claude

> **💡 Dica:** Você pode usar o sistema **100% offline** sem nenhuma conta externa!

## 2. Setup Inicial

### 2.1 Criar Estrutura do Projeto

```bash
# Criar diretório
mkdir mcp-rlm-mem0
cd mcp-rlm-mem0

# Inicializar projeto
npm init -y

# Instalar dependências CORE (funciona 100% offline)
npm install @modelcontextprotocol/sdk chromadb sqlite3
npm install -D typescript @types/node ts-node

# Instalar Mem0 apenas se quiser sincronização cloud (OPCIONAL)
npm install mem0ai

# Inicializar TypeScript
npx tsc --init
```

### 2.2 Configurar TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

### 2.3 Configurar Variáveis de Ambiente

#### Opção A: Standalone (100% Offline) - RECOMENDADO

```bash
# .env
# Mem0 NÃO configurado = modo standalone automático
# MEM0_API_KEY=

# Configurações locais
PROJECT_PATH=/caminho/do/projeto
LOCAL_DB_PATH=./data/memory.db
CACHE_PATH=./cache
LOG_LEVEL=info
OPERATION_MODE=standalone
```

#### Opção B: Híbrido (com Mem0 opcional)

```bash
# .env
MEM0_API_KEY=sua-api-key-aqui
MEM0_HOST=https://api.mem0.ai
PROJECT_PATH=/caminho/do/projeto
LOCAL_DB_PATH=./data/memory.db
CACHE_PATH=./cache
LOG_LEVEL=info
OPERATION_MODE=hybrid
PREFER_LOCAL=true  # Usa local quando possível
```

## 3. Implementação Passo a Passo

### 3.1 Estrutura de Diretórios

```
mcp-rlm-mem0/
├── src/
│   ├── index.ts                   # Entry point
│   ├── server.ts                  # MCP Server
│   ├── config.ts                  # Configurações
│   ├── types.ts                   # Tipos TypeScript
│   ├── memory/                    # Sistema de memória
│   │   ├── local-memory.ts       # Memória local (standalone)
│   │   ├── unified-manager.ts    # Manager unificado
│   │   └── mem0-client.ts        # Cliente Mem0 (opcional)
│   ├── compression.ts            # Compressão semântica
│   ├── cache.ts                  # Sistema de cache
│   ├── router.ts                 # Context router
│   ├── retrieval/
│   │   ├── index.ts              # Exportações
│   │   ├── vector.ts             # Busca vetorial
│   │   ├── keyword.ts            # Busca por keywords
│   │   └── hybrid.ts             # Busca híbrida
│   └── utils/
│       ├── tokenizer.ts          # Tokenização
│       ├── hash.ts               # Hashing
│       └── logger.ts             # Logging
├── data/                          # Dados locais (SQLite)
│   └── memory.db                 # Banco local
├── tests/
├── build/                         # Output compilado
├── cache/                    # Cache local
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

### 3.2 Implementar Tipos

```typescript
// src/types.ts

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Memory {
  id: string;
  content: string;
  type: 'preference' | 'conversation' | 'code' | 'decision';
  metadata: Record<string, any>;
  score?: number;
  timestamp: Date;
}

export interface ContextStrategy {
  type: 'minimal' | 'compressed' | 'balanced' | 'full';
  maxTokens: number;
  include: string[];
  models: string[];
}

export interface CompressedContent {
  structure: string;
  publicAPI: string;
  dependencies: string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    hash: string;
    language: string;
  };
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: Date;
  ttl: number;
  hits: number;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}
```

### 3.3 Implementar Configurações

```typescript
// src/config.ts

import { config } from 'dotenv';
config();

export const CONFIG = {
  // Mem0
  mem0: {
    apiKey: process.env.MEM0_API_KEY || '',
    host: process.env.MEM0_HOST || 'https://api.mem0.ai'
  },
  
  // OpenAI (opcional)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },
  
  // Projeto
  project: {
    path: process.env.PROJECT_PATH || './',
    cachePath: process.env.CACHE_PATH || './cache'
  },
  
  // Limites
  limits: {
    maxTokensPerRequest: 8000,
    maxMemoriesPerQuery: 20,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    defaultTTL: 3600 // 1 hora
  },
  
  // Otimização
  optimization: {
    enableCompression: true,
    enableCaching: true,
    enableRouting: true,
    compressionLevel: 'standard' as const
  }
};
```

### 3.4 Implementar Cliente Mem0

```typescript
// src/mem0-client.ts

import { MemoryClient } from 'mem0ai';
import { CONFIG } from './config.js';
import { Memory, Message } from './types.js';

export class Mem0Integration {
  private client: MemoryClient;
  
  constructor() {
    this.client = new MemoryClient({
      apiKey: CONFIG.mem0.apiKey,
      host: CONFIG.mem0.host
    });
  }
  
  async addMemory(
    messages: Message[],
    userId: string,
    sessionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.client.add({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      user_id: userId,
      session_id: sessionId,
      metadata
    });
  }
  
  async searchMemories(
    query: string,
    userId: string,
    sessionId?: string,
    options: {
      limit?: number;
      type?: string;
    } = {}
  ): Promise<Memory[]> {
    const results = await this.client.search({
      query,
      user_id: userId,
      session_id: sessionId,
      limit: options.limit || 10,
      filters: options.type ? { type: options.type } : undefined
    });
    
    return results.map(r => ({
      id: r.id,
      content: r.memory,
      type: r.metadata?.type || 'conversation',
      metadata: r.metadata || {},
      score: r.score,
      timestamp: new Date(r.created_at)
    }));
  }
  
  async getUserPreferences(
    userId: string,
    query: string
  ): Promise<string[]> {
    const memories = await this.searchMemories(query, userId, undefined, {
      limit: 5,
      type: 'preference'
    });
    return memories.map(m => m.content);
  }
  
  async getSessionContext(
    userId: string,
    sessionId: string,
    query: string
  ): Promise<string[]> {
    const memories = await this.searchMemories(query, userId, sessionId, {
      limit: 10,
      type: 'conversation'
    });
    return memories.map(m => m.content);
  }
}
```

### 3.5 Implementar Compressão

```typescript
// src/compression.ts

import { CompressedContent } from './types.js';

export class SemanticCompressor {
  async compressCode(
    content: string,
    language: string = 'typescript'
  ): Promise<CompressedContent> {
    const lines = content.split('\n');
    const originalSize = content.length;
    
    // Extrai estrutura (classes, interfaces, funções)
    const structure = this.extractStructure(lines, language);
    
    // Extrai API pública
    const publicAPI = this.extractPublicAPI(lines, language);
    
    // Extrai dependências
    const dependencies = this.extractDependencies(lines, language);
    
    const compressed = [
      structure,
      publicAPI,
      dependencies
    ].join('\n');
    
    return {
      structure,
      publicAPI,
      dependencies,
      metadata: {
        originalSize,
        compressedSize: compressed.length,
        hash: this.computeHash(content),
        language
      }
    };
  }
  
  private extractStructure(lines: string[], language: string): string {
    const patterns = {
      typescript: /^(export\s+)?(class|interface|enum|type)\s+(\w+)/,
      python: /^(class|def)\s+(\w+)/,
      rust: /^(pub\s+)?(struct|enum|trait|impl|fn)\s+(\w+)/
    };
    
    const pattern = patterns[language as keyof typeof patterns] || patterns.typescript;
    const structures: string[] = [];
    
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        structures.push(line.trim());
      }
    }
    
    return structures.join('\n');
  }
  
  private extractPublicAPI(lines: string[], language: string): string {
    const patterns = {
      typescript: /^(export\s+)?(async\s+)?(function|const|let|var)\s+(\w+).*[:\(]/,
      python: /^(def|async\s+def)\s+(\w+)/
    };
    
    const pattern = patterns[language as keyof typeof patterns] || patterns.typescript;
    const apis: string[] = [];
    
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && !line.includes('private') && !line.startsWith('_')) {
        apis.push(line.trim());
      }
    }
    
    return apis.join('\n');
  }
  
  private extractDependencies(lines: string[], language: string): string {
    const imports: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('import ') || line.startsWith('from ') || 
          line.startsWith('require(') || line.startsWith('use ')) {
        imports.push(line.trim());
      }
    }
    
    return imports.join('\n');
  }
  
  private computeHash(content: string): string {
    // Implementação simples de hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
```

### 3.6 Implementar Cache

```typescript
// src/cache.ts

import { CacheEntry } from './types.js';
import { CONFIG } from './config.js';

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  
  constructor() {
    this.cache = new Map();
    this.maxSize = CONFIG.limits.maxCacheSize;
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Verifica TTL
    if (Date.now() - entry.timestamp.getTime() > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.value as T;
  }
  
  set<T>(key: string, value: T, ttl: number = CONFIG.limits.defaultTTL): void {
    // Limpa cache se necessário
    if (this.cache.size >= 1000) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      key,
      value,
      timestamp: new Date(),
      ttl,
      hits: 0
    });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  private evictLRU(): void {
    let oldest: CacheEntry | null = null;
    let oldestKey: string | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  getStats(): {
    size: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const entries = Array.from(this.cache.values()).map(e => ({
      key: e.key,
      hits: e.hits,
      age: Date.now() - e.timestamp.getTime()
    }));
    
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    
    return {
      size: this.cache.size,
      hitRate: totalHits / (totalHits + this.cache.size) || 0,
      entries
    };
  }
}
```

### 3.7 Implementar MCP Server

```typescript
// src/server.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Mem0Integration } from './mem0-client.js';
import { SemanticCompressor } from './compression.js';
import { CacheManager } from './cache.js';

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: 'rlm-mem0-server',
    version: '1.0.0'
  });
  
  const mem0 = new Mem0Integration();
  const compressor = new SemanticCompressor();
  const cache = new CacheManager();
  
  // Tool: get_optimized_context
  server.registerTool(
    'get_optimized_context',
    {
      description: 'Recupera contexto otimizado com economia de tokens',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          userId: { type: 'string' },
          sessionId: { type: 'string' },
          projectPath: { type: 'string' },
          maxTokens: { type: 'number', default: 4000 }
        },
        required: ['query', 'userId', 'sessionId']
      }
    },
    async ({ query, userId, sessionId, maxTokens }) => {
      const cacheKey = `context:${userId}:${sessionId}:${query}`;
      
      // Tenta cache
      const cached = cache.get(cacheKey);
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ ...cached, fromCache: true })
          }]
        };
      }
      
      // Recupera memórias
      const [preferences, sessionContext] = await Promise.all([
        mem0.getUserPreferences(userId, query),
        mem0.getSessionContext(userId, sessionId, query)
      ]);
      
      const result = {
        context: {
          preferences,
          sessionContext,
          query
        },
        stats: {
          preferencesCount: preferences.length,
          sessionContextCount: sessionContext.length,
          estimatedTokens: preferences.length * 50 + sessionContext.length * 100
        }
      };
      
      // Armazena no cache
      cache.set(cacheKey, result, 300); // 5 minutos
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    }
  );
  
  // Tool: store_memory
  server.registerTool(
    'store_memory',
    {
      description: 'Armazena uma memória no Mem0',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          userId: { type: 'string' },
          sessionId: { type: 'string' },
          type: {
            type: 'string',
            enum: ['preference', 'conversation', 'code', 'decision']
          },
          metadata: { type: 'object' }
        },
        required: ['content', 'userId', 'sessionId', 'type']
      }
    },
    async ({ content, userId, sessionId, type, metadata }) => {
      await mem0.addMemory(
        [{ role: 'user', content }],
        userId,
        sessionId,
        { type, ...metadata }
      );
      
      return {
        content: [{
          type: 'text',
          text: `Memory stored successfully as ${type}`
        }]
      };
    }
  );
  
  // Tool: search_memories
  server.registerTool(
    'search_memories',
    {
      description: 'Busca memórias relevantes',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          userId: { type: 'string' },
          limit: { type: 'number', default: 5 },
          type: { type: 'string' }
        },
        required: ['query', 'userId']
      }
    },
    async ({ query, userId, limit, type }) => {
      const memories = await mem0.searchMemories(query, userId, undefined, {
        limit,
        type
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(memories, null, 2)
        }]
      };
    }
  );
  
  // Tool: compress_code
  server.registerTool(
    'compress_code',
    {
      description: 'Comprime código semanticamente',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string', default: 'typescript' }
        },
        required: ['code']
      }
    },
    async ({ code, language }) => {
      const compressed = await compressor.compressCode(code, language);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            compressed,
            savings: `${((1 - compressed.metadata.compressedSize / compressed.metadata.originalSize) * 100).toFixed(1)}%`
          }, null, 2)
        }]
      };
    }
  );
  
  // Resource: cache_stats
  server.registerResource(
    'cache_stats',
    {
      description: 'Estatísticas do cache',
      mimeType: 'application/json'
    },
    async () => {
      const stats = cache.getStats();
      return {
        contents: [{
          uri: 'cache://stats',
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    }
  );
  
  // Inicia servidor
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('MCP RLM-Mem0 server running on stdio');
}
```

### 3.8 Entry Point

```typescript
// src/index.ts

import { startServer } from './server.js';

async function main(): Promise<void> {
  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
```

## 4. Compilar e Testar

### 4.1 Compilar

```bash
# Compilar TypeScript
npx tsc

# Verificar build
ls -la build/
```

### 4.2 Testar Localmente

```bash
# Executar servidor
node build/index.js

# Testar com MCP Inspector (opcional)
npx @modelcontextprotocol/inspector node build/index.js
```

## 5. Configurar no OpenCode

### 5.1 Configuração MCP

```json
// ~/.config/opencode/mcp.json (ou equivalente)
{
  "mcpServers": {
    "rlm-mem0": {
      "command": "node",
      "args": ["/caminho/para/mcp-rlm-mem0/build/index.js"],
      "env": {
        "MEM0_API_KEY": "sua-api-key",
        "MEM0_HOST": "https://api.mem0.ai",
        "PROJECT_PATH": "/caminho/do/projeto"
      }
    }
  }
}
```

### 5.2 Verificar Integração

1. Reinicie o OpenCode
2. Verifique se o servidor aparece na lista de MCPs
3. Teste as tools:
   - `store_memory`
   - `search_memories`
   - `get_optimized_context`

## 6. Troubleshooting

### 6.1 Problemas Comuns

| Problema | Solução |
|----------|---------|
| `Module not found` | Verifique se compilou com `npx tsc` |
| `MEM0_API_KEY not set` | **Normal!** Sistema funciona sem Mem0 (modo standalone) |
| `Connection refused` | Verifique se Mem0 está rodando (somente se usar self-hosted) |
| `Cache não funciona` | Verifique permissões de escrita no diretório cache |
| `SQLite error` | Verifique se diretório `./data` existe e tem permissão de escrita |
| `Quero usar offline` | Não configure MEM0_API_KEY = modo standalone automático |

### 6.2 Debug Mode

```bash
# Habilitar debug
DEBUG=true node build/index.js

# Ou com logging detalhado
LOG_LEVEL=debug node build/index.js
```

## 7. Modos de Operação

### 7.1 Modo Standalone (Padrão)

Funciona 100% offline sem Mem0:

```typescript
// src/index.ts
import { LocalMemoryManager } from './memory/local-memory.js';

const memory = new LocalMemoryManager({
  dbPath: './data/memory.db',
  enableCompression: true
});

// Sistema pronto para uso!
console.log('✅ MCP RLM rodando em modo STANDALONE');
console.log('💡 Dica: Configure MEM0_API_KEY para habilitar sincronização');
```

### 7.2 Modo Híbrido (com Mem0)

Usa Mem0 como complemento:

```typescript
// src/index.ts
import { UnifiedMemoryManager } from './memory/unified-manager.js';

const memory = new UnifiedMemoryManager('hybrid');

// Usa local primeiro, sincroniza com Mem0 quando possível
console.log('✅ MCP RLM rodando em modo HÍBRIDO');
```

## 8. Próximos Passos

1. **Escolher modo**: Standalone (offline) ou Híbrido (com sync)
2. **Testar** com projeto real no OpenCode
3. **Monitorar** métricas de economia
4. **Ajustar** parâmetros de compressão
5. **Expandir** com mais tools (indexação de código, graph RAG)
6. **Documentar** casos de uso específicos
