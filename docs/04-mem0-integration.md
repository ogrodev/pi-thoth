# Integração com Mem0.ai (OPCIONAL)

> **⚠️ NOTA IMPORTANTE:** Mem0.ai é **completamente opcional**. O sistema MCP RLM funciona 100% offline com SQLite local. Use Mem0 apenas se precisar de sincronização entre dispositivos ou backup em nuvem.

## 1. Quando Usar Mem0.ai?

### Use Mem0 se:
- ✅ Trabalha em múltiplos dispositivos
- ✅ Precisa de backup automático
- ✅ Quer sincronização entre máquinas
- ✅ Precisa de analytics avançados

### NÃO use Mem0 se:
- ✅ Trabalha em um único dispositivo
- ✅ Prioriza privacidade máxima
- ✅ Quer zero custos
- ✅ Ambiente offline/air-gapped

## 2. O que é Mem0.ai?

Mem0.ai é uma **camada de memória universal** para agentes de IA que oferece:

- **90% menos tokens** que contexto completo
- **91% mais rápido** que full-context
- **+26% de precisão** vs OpenAI Memory
- Multi-nível: User, Session, Agent memory

## 3. Arquitetura do Mem0

```
┌─────────────────────────────────────────────────────────────┐
│                    MEM0.AI PLATFORM                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 USER MEMORY                           │  │
│  │  • Preferências do usuário                            │  │
│  │  • Padrões de comportamento                           │  │
│  │  • Decisões persistentes                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                SESSION MEMORY                         │  │
│  │  • Conversa atual                                     │  │
│  │  • Contexto temporário                                │  │
│  │  • Estado da interação                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 AGENT MEMORY                          │  │
│  │  • Conhecimento específico do agente                  │  │
│  │  • Regras e guidelines                                │  │
│  │  • Capacidades aprendidas                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              VECTOR STORE (Embeddings)                │  │
│  │  • Busca semântica                                    │  │
│  │  • Similaridade de contexto                           │  │
│  │  • Recuperação inteligente                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 3. Configuração

### 3.1 Opção 1: Cloud (Recomendado para iniciar)

```bash
# Instalação
npm install mem0ai

# Configuração
export MEM0_API_KEY="sua-api-key"
```

```typescript
// src/mem0-client.ts
import { MemoryClient } from 'mem0ai';

const client = new MemoryClient({
  apiKey: process.env.MEM0_API_KEY
});
```

### 3.2 Opção 2: Self-Hosted (Mais controle)

```bash
# Clone o repositório
git clone https://github.com/mem0ai/mem0.git
cd mem0

# Inicie com Docker Compose
docker-compose up -d

# O serviço estará disponível em http://localhost:8000
```

```typescript
const client = new MemoryClient({
  host: 'http://localhost:8000',
  apiKey: 'local-dev-key' // Opcional para local
});
```

## 4. Operações Principais

### 4.1 Adicionar Memória

```typescript
// Armazenar uma interação
async function storeInteraction(
  userId: string,
  sessionId: string,
  messages: Message[]
): Promise<void> {
  await client.add({
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    })),
    user_id: userId,
    session_id: sessionId,
    metadata: {
      type: 'conversation',
      project: 'meu-projeto',
      timestamp: new Date().toISOString()
    }
  });
}

// Armazenar preferência
async function storePreference(
  userId: string,
  preference: string
): Promise<void> {
  await client.add({
    messages: [{
      role: 'system',
      content: `Preference: ${preference}`
    }],
    user_id: userId,
    metadata: {
      type: 'preference',
      category: 'coding-style'
    }
  });
}
```

### 4.2 Buscar Memória

```typescript
// Buscar memórias relevantes
async function searchMemories(
  query: string,
  userId: string,
  sessionId: string,
  options: SearchOptions = {}
): Promise<Memory[]> {
  const results = await client.search({
    query,
    user_id: userId,
    session_id: sessionId,
    limit: options.limit || 10,
    filters: {
      type: options.type, // 'preference', 'conversation', 'code', 'decision'
      ...options.filters
    }
  });
  
  return results.map(r => ({
    id: r.id,
    content: r.memory,
    score: r.score,
    metadata: r.metadata,
    timestamp: r.created_at
  }));
}

// Exemplo de uso
const memories = await searchMemories(
  "como autenticar usuários",
  "user-123",
  "session-456",
  { type: 'code', limit: 5 }
);
```

### 4.3 Atualizar Memória

```typescript
// Atualizar memória existente
async function updateMemory(
  memoryId: string,
  newContent: string
): Promise<void> {
  await client.update({
    memory_id: memoryId,
    memory: newContent
  });
}

// Adicionar a memória existente
async function appendToMemory(
  memoryId: string,
  additionalContent: string
): Promise<void> {
  const existing = await client.get({ memory_id: memoryId });
  await updateMemory(memoryId, existing.memory + '\n' + additionalContent);
}
```

### 4.4 Deletar Memória

```typescript
// Deletar memória específica
async function deleteMemory(memoryId: string): Promise<void> {
  await client.delete({ memory_id: memoryId });
}

// Deletar todas as memórias de um usuário
async function deleteUserMemories(userId: string): Promise<void> {
  await client.delete({ user_id: userId });
}

// Deletar memórias de uma sessão
async function deleteSessionMemories(sessionId: string): Promise<void> {
  await client.delete({ session_id: sessionId });
}
```

## 5. Integração com MCP Server

### 5.1 Tool: store_memory

```typescript
server.registerTool(
  'store_memory',
  {
    description: 'Armazena uma memória no Mem0',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Conteúdo da memória'
        },
        type: {
          type: 'string',
          enum: ['preference', 'conversation', 'code', 'decision'],
          description: 'Tipo da memória'
        },
        metadata: {
          type: 'object',
          description: 'Metadados adicionais'
        }
      },
      required: ['content', 'type']
    }
  },
  async ({ content, type, metadata }) => {
    const session = getCurrentSession();
    
    await client.add({
      messages: [{ role: 'user', content }],
      user_id: session.userId,
      session_id: session.id,
      metadata: {
        type,
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
    
    return {
      content: [{
        type: 'text',
        text: `Memory stored successfully as ${type}`
      }]
    };
  }
);
```

### 5.2 Tool: search_memories

```typescript
server.registerTool(
  'search_memories',
  {
    description: 'Busca memórias relevantes no Mem0',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query de busca'
        },
        limit: {
          type: 'number',
          default: 5,
          description: 'Número máximo de resultados'
        },
        type: {
          type: 'string',
          enum: ['preference', 'conversation', 'code', 'decision', 'all'],
          default: 'all'
        }
      },
      required: ['query']
    }
  },
  async ({ query, limit, type }) => {
    const session = getCurrentSession();
    
    const results = await client.search({
      query,
      user_id: session.userId,
      session_id: session.id,
      limit,
      filters: type !== 'all' ? { type } : undefined
    });
    
    const formatted = results.map(r => 
      `[${r.metadata.type}] ${r.memory} (score: ${r.score.toFixed(2)})`
    ).join('\n');
    
    return {
      content: [{
        type: 'text',
        text: formatted || 'No relevant memories found'
      }]
    };
  }
);
```

### 5.3 Tool: get_user_context

```typescript
server.registerTool(
  'get_user_context',
  {
    description: 'Recupera contexto completo do usuário',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query atual para buscar memórias relevantes'
        }
      },
      required: ['query']
    }
  },
  async ({ query }) => {
    const session = getCurrentSession();
    
    // Busca em paralelo
    const [preferences, recentConversations] = await Promise.all([
      client.search({
        query,
        user_id: session.userId,
        filters: { type: 'preference' },
        limit: 5
      }),
      client.search({
        query,
        user_id: session.userId,
        session_id: session.id,
        filters: { type: 'conversation' },
        limit: 10
      })
    ]);
    
    const context = {
      preferences: preferences.map(p => p.memory),
      recentContext: recentConversations.map(c => c.memory),
      stats: {
        preferencesFound: preferences.length,
        conversationsFound: recentConversations.length
      }
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(context, null, 2)
      }]
    };
  }
);
```

## 6. Padrões de Uso

### 6.1 Armazenamento Automático

```typescript
// Middleware para armazenar automaticamente
class MemoryMiddleware {
  async processInteraction(
    userMessage: string,
    assistantResponse: string,
    context: Context
  ): Promise<void> {
    // Extrai preferências
    const preferences = this.extractPreferences(userMessage, assistantResponse);
    for (const pref of preferences) {
      await this.storePreference(context.userId, pref);
    }
    
    // Armazena conversa
    await this.storeConversation(context, [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantResponse }
    ]);
    
    // Extrai decisões
    const decisions = this.extractDecisions(assistantResponse);
    for (const decision of decisions) {
      await this.storeDecision(context, decision);
    }
  }
  
  private extractPreferences(userMsg: string, assistantMsg: string): string[] {
    // Lógica para identificar preferências
    const preferences = [];
    
    // Exemplo: "Eu prefiro usar async/await"
    if (userMsg.includes('prefiro') || userMsg.includes('gosto de')) {
      preferences.push(userMsg);
    }
    
    return preferences;
  }
}
```

### 6.2 Enriquecimento de Contexto

```typescript
// Enriquece o prompt com memórias relevantes
async function enrichPrompt(
  basePrompt: string,
  query: string,
  userId: string,
  sessionId: string
): Promise<string> {
  // Busca memórias relevantes
  const memories = await client.search({
    query,
    user_id: userId,
    session_id: sessionId,
    limit: 10
  });
  
  // Separa por tipo
  const preferences = memories.filter(m => m.metadata.type === 'preference');
  const decisions = memories.filter(m => m.metadata.type === 'decision');
  const code = memories.filter(m => m.metadata.type === 'code');
  
  // Monta contexto enriquecido
  const enriched = `
${basePrompt}

## Contexto do Usuário
${preferences.length > 0 ? `
### Preferências
${preferences.map(p => `- ${p.memory}`).join('\n')}
` : ''}

${decisions.length > 0 ? `
### Decisões Anteriores
${decisions.map(d => `- ${d.memory}`).join('\n')}
` : ''}

${code.length > 0 ? `
### Código Relacionado
${code.map(c => `- ${c.memory}`).join('\n')}
` : ''}
`;
  
  return enriched;
}
```

## 7. Melhores Práticas

### 7.1 Organização de Memórias

```typescript
// Use metadados para organizar
const memoryTypes = {
  preference: {
    description: 'Preferências do usuário',
    ttl: null, // Persistente
    priority: 'high'
  },
  conversation: {
    description: 'Conversas recentes',
    ttl: 86400, // 24 horas
    priority: 'medium'
  },
  code: {
    description: 'Padrões de código',
    ttl: 604800, // 7 dias
    priority: 'high'
  },
  decision: {
    description: 'Decisões arquiteturais',
    ttl: null, // Persistente
    priority: 'high'
  }
};
```

### 7.2 Limpeza de Memórias

```typescript
// Job de limpeza periódica
async function cleanupOldMemories(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // 30 dias
  
  const oldMemories = await client.search({
    query: '*',
    filters: {
      timestamp: { $lt: cutoff.toISOString() },
      type: 'conversation' // Apenas conversas antigas
    }
  });
  
  for (const memory of oldMemories) {
    await client.delete({ memory_id: memory.id });
  }
}
```

## 8. Alternativa: Memória Local (Sem Mem0)

Se preferir não usar Mem0.ai, o sistema funciona completamente com SQLite local:

```typescript
// Exemplo usando apenas memória local
import { LocalMemoryManager } from './memory/local-memory.js';

const memory = new LocalMemoryManager({
  dbPath: './data/memory.db',
  enableCompression: true
});

// Mesma API, sem dependência externa
await memory.add({
  content: 'Preferência do usuário',
  type: 'preference'
});

const results = await memory.search('query');
```

**Vantagens da memória local:**
- ✅ 100% offline
- ✅ Zero custo
- ✅ Privacidade máxima
- ✅ Sem setup de API keys

**Desvantagens:**
- ❌ Sem sincronização entre dispositivos
- ❌ Sem backup automático em nuvem

Veja [13-standalone-architecture.md](./13-standalone-architecture.md) para detalhes completos.

## 9. Troubleshooting

### 9.1 Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| Memórias não aparecem | Filtros muito restritivos | Remover filtros ou ajustar |
| Latência alta | Muitas memórias | Implementar paginação |
| Memórias duplicadas | Sem verificação de existência | Verificar antes de inserir |
| Contexto irrelevante | Query muito genérica | Refinar query de busca |
| Quero usar offline | Mem0 requer internet | Use modo standalone (SQLite) |

### 9.2 Debugging

```typescript
// Modo debug
const DEBUG = process.env.DEBUG === 'true';

async function debugSearch(query: string): Promise<void> {
  if (!DEBUG) return;
  
  console.log('=== Mem0 Debug ===');
  console.log('Query:', query);
  
  const start = Date.now();
  const results = await client.search({ query, limit: 10 });
  const duration = Date.now() - start;
  
  console.log('Duration:', duration, 'ms');
  console.log('Results:', results.length);
  console.log('Scores:', results.map(r => r.score));
  console.log('==================');
}
```
