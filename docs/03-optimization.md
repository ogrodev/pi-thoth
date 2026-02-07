# Estratégias de Otimização e Economia

## 1. Compressão Semântica (70% de Economia)

### 1.1 Princípios

A compressão semântica mantém o **significado** e a **estrutura** do código/documento, removendo detalhes de implementação que não são necessários para o entendimento de alto nível.

### 1.2 Algoritmo de Compressão

```typescript
// src/compression.ts

interface CompressionOptions {
  level: 'minimal' | 'standard' | 'aggressive';
  preserveTypes: boolean;
  preserveDocs: boolean;
  maxTokens: number;
}

class SemanticCompressor {
  async compress(
    content: string,
    options: CompressionOptions
  ): Promise<CompressedContent> {
    const ast = await this.parseAST(content);
    
    return {
      // Estrutura (30%)
      structure: this.extractStructure(ast),
      
      // API Pública (40%)
      publicAPI: this.extractPublicAPI(ast),
      
      // Dependências (20%)
      dependencies: this.extractDependencies(ast),
      
      // Metadados (10%)
      metadata: {
        originalSize: content.length,
        compressedSize: 0, // calculado depois
        hash: this.computeHash(content),
        language: this.detectLanguage(content)
      }
    };
  }
  
  private extractStructure(ast: AST): string {
    // Extrai classes, interfaces, enums
    return ast.declarations
      .filter(d => d.isExported)
      .map(d => `${d.type} ${d.name}`)
      .join('\n');
  }
  
  private extractPublicAPI(ast: AST): string {
    // Extrai métodos e funções públicas
    return ast.functions
      .filter(f => f.isPublic || f.isExported)
      .map(f => `${f.name}(${f.params}): ${f.returnType}`)
      .join('\n');
  }
}
```

### 1.3 Exemplos de Compressão

#### TypeScript/JavaScript

**Original (450 tokens):**
```typescript
export class AuthenticationService {
  private readonly jwtSecret: string;
  private readonly tokenExpiry: number;
  private userRepository: UserRepository;

  constructor(
    jwtSecret: string,
    tokenExpiry: number = 3600,
    userRepository: UserRepository
  ) {
    this.jwtSecret = jwtSecret;
    this.tokenExpiry = tokenExpiry;
    this.userRepository = userRepository;
  }

  async authenticate(
    email: string,
    password: string
  ): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid password');
    }
    
    const token = jwt.sign(
      { userId: user.id },
      this.jwtSecret,
      { expiresIn: this.tokenExpiry }
    );
    
    return { user, token };
  }
}
```

**Comprimido (80 tokens):**
```
AuthenticationService:
  - authenticate(email, password): Promise<AuthResult>
  - jwtSecret: string, tokenExpiry: number
  - userRepository: UserRepository
  Deps: bcrypt, jwt
  Errors: UnauthorizedError
```

**Economia: 82%**

#### Python

**Original (380 tokens):**
```python
class DataProcessor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.cache = CacheManager()
    
    def process_batch(
        self,
        data: List[Dict],
        batch_size: int = 100
    ) -> ProcessingResult:
        results = []
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            processed = self._process_chunk(batch)
            results.extend(processed)
        
        self.logger.info(f"Processed {len(data)} items")
        return ProcessingResult(
            total=len(data),
            successful=len([r for r in results if r.success]),
            failed=len([r for r in results if not r.success]),
            results=results
        )
    
    def _process_chunk(self, chunk: List[Dict]) -> List[ProcessedItem]:
        # Implementation details...
        pass
```

**Comprimido (65 tokens):**
```
DataProcessor:
  - process_batch(data, batch_size=100): ProcessingResult
  - _process_chunk(chunk): List[ProcessedItem]
  Config: Dict[str, Any]
  Deps: logging, CacheManager
  Returns: ProcessingResult(total, successful, failed, results)
```

**Economia: 83%**

### 1.4 Compressão de Conversas

```typescript
class ConversationCompressor {
  async compress(messages: Message[]): Promise<ConversationSummary> {
    // Agrupa mensagens em tópicos
    const topics = await this.identifyTopics(messages);
    
    // Gera resumo por tópico
    const summaries = await Promise.all(
      topics.map(t => this.summarizeTopic(t))
    );
    
    // Extrai decisões e preferências
    const decisions = this.extractDecisions(messages);
    const preferences = this.extractPreferences(messages);
    
    return {
      summary: summaries.join('\n'),
      decisions,
      preferences,
      keyReferences: this.extractReferences(messages),
      originalLength: messages.length,
      compressedLength: summaries.length
    };
  }
}
```

## 2. Prompt Caching Inteligente (50% de Economia)

### 2.1 Estrutura Hierárquica

```typescript
interface HierarchicalPrompt {
  // Camada 1: Sistema (raramente muda)
  system: {
    content: string;
    hash: string;
    lastModified: Date;
  };
  
  // Camada 2: Projeto (muda ocasionalmente)
  project: {
    content: string;
    hash: string;
    architecture: string;
    lastIndexed: Date;
  };
  
  // Camada 3: Sessão (muda frequentemente)
  session: {
    content: string;
    hash: string;
    recentMessages: Message[];
  };
  
  // Camada 4: Query (sempre nova)
  query: {
    content: string;
    timestamp: Date;
  };
}
```

### 2.2 Algoritmo de Cache

```typescript
class SmartPromptCache {
  private cache: Map<string, CacheEntry>;
  
  async getCachedResponse(
    prompt: HierarchicalPrompt
  ): Promise<string | null> {
    // Gera chaves para cada nível
    const keys = {
      full: this.hashPrompt(prompt),
      withoutQuery: this.hashPrompt({
        ...prompt,
        query: null
      }),
      systemProject: this.hashPrompt({
        system: prompt.system,
        project: prompt.project
      })
    };
    
    // Tenta match exato
    if (this.cache.has(keys.full)) {
      return this.cache.get(keys.full)!.response;
    }
    
    // Tenta match sem query (reutiliza estrutura)
    const withoutQuery = this.cache.get(keys.withoutQuery);
    if (withoutQuery) {
      // Reusa contexto, apenas muda query
      return this.generateWithCachedContext(
        withoutQuery,
        prompt.query.content
      );
    }
    
    // Tenta match de sistema/projeto
    const sysProj = this.cache.get(keys.systemProject);
    if (sysProj) {
      // Reusa arquitetura, adiciona sessão
      return this.generateWithCachedProject(
        sysProj,
        prompt.session,
        prompt.query.content
      );
    }
    
    return null;
  }
  
  private async generateWithCachedContext(
    cached: CacheEntry,
    newQuery: string
  ): Promise<string> {
    // Usa modelo mais barato para queries simples
    const response = await this.llm.generate({
      model: 'gpt-3.5-turbo', // Mais barato
      messages: [
        { role: 'system', content: cached.context },
        { role: 'user', content: newQuery }
      ]
    });
    
    return response;
  }
}
```

### 2.3 Taxas de Acerto por Camada

| Camada | Taxa de Acerto | Economia |
|--------|---------------|----------|
| Full (exato) | 15% | 100% |
| Sem query | 35% | 80% |
| Sistema/Projeto | 25% | 60% |
| Cache miss | 25% | 0% |
| **Média** | **~50%** | **~50%** |

## 3. Context Router (30% de Economia)

### 3.1 Classificação de Queries

```typescript
interface QueryAnalysis {
  type: 'simple' | 'code' | 'architecture' | 'debug' | 'refactor';
  complexity: number; // 0-1
  requiresHistory: boolean;
  requiresCode: boolean;
  requiresDocs: boolean;
}

class QueryClassifier {
  async analyze(query: string): Promise<QueryAnalysis> {
    const patterns = {
      simple: /^(o que|como|qual|quando|onde|por que)\s/i,
      code: /\b(função|classe|método|implementar|código)\b/i,
      architecture: /\b(arquitetura|estrutura|padrão|design)\b/i,
      debug: /\b(erro|bug|problema|falha|exception)\b/i,
      refactor: /\b(refatorar|melhorar|otimizar|limpar)\b/i
    };
    
    const type = this.matchPattern(query, patterns);
    const complexity = await this.estimateComplexity(query);
    
    return {
      type,
      complexity,
      requiresHistory: this.needsHistory(query),
      requiresCode: this.needsCode(query),
      requiresDocs: this.needsDocs(query)
    };
  }
}
```

### 3.2 Estratégias por Tipo

```typescript
class ContextRouter {
  async route(query: string): Promise<ContextStrategy> {
    const analysis = await this.classifier.analyze(query);
    
    switch(analysis.type) {
      case 'simple':
        return {
          tokens: 500,
          include: ['recent-messages'],
          models: ['gpt-3.5-turbo']
        };
        
      case 'code':
        return {
          tokens: 2000,
          include: ['architecture', 'relevant-files', 'recent-changes'],
          models: ['gpt-4-mini']
        };
        
      case 'architecture':
        return {
          tokens: 4000,
          include: ['full-architecture', 'patterns', 'dependencies'],
          models: ['gpt-4']
        };
        
      case 'debug':
        return {
          tokens: 6000,
          include: ['error-logs', 'stack-traces', 'related-code', 'tests'],
          models: ['gpt-4']
        };
        
      case 'refactor':
        return {
          tokens: 5000,
          include: ['target-code', 'dependencies', 'tests', 'patterns'],
          models: ['gpt-4']
        };
    }
  }
}
```

### 3.3 Exemplos de Routing

| Query | Tipo | Tokens | Modelo |
|-------|------|--------|--------|
| "O que é uma Promise?" | simple | 500 | GPT-3.5 |
| "Como funciona o auth?" | code | 2000 | GPT-4-mini |
| "Qual a arquitetura do projeto?" | architecture | 4000 | GPT-4 |
| "Por que está dando erro 500?" | debug | 6000 | GPT-4 |
| "Como refatorar esse código?" | refactor | 5000 | GPT-4 |

## 4. Model Tiering (Economia Adicional)

### 4.1 Seleção Inteligente de Modelos

```typescript
interface ModelConfig {
  name: string;
  costPer1K: number;
  maxTokens: number;
  strengths: string[];
}

const MODELS: ModelConfig[] = [
  {
    name: 'gpt-3.5-turbo',
    costPer1K: 0.0015,
    maxTokens: 4096,
    strengths: ['simple-queries', 'summarization']
  },
  {
    name: 'gpt-4-mini',
    costPer1K: 0.003,
    maxTokens: 8192,
    strengths: ['code', 'explanations']
  },
  {
    name: 'gpt-4',
    costPer1K: 0.03,
    maxTokens: 8192,
    strengths: ['complex-reasoning', 'architecture']
  }
];

class ModelRouter {
  selectModel(query: string, complexity: number): ModelConfig {
    if (complexity < 0.3) {
      return MODELS[0]; // GPT-3.5 (20x mais barato)
    } else if (complexity < 0.7) {
      return MODELS[1]; // GPT-4-mini (10x mais barato)
    } else {
      return MODELS[2]; // GPT-4 (apenas quando necessário)
    }
  }
}
```

### 4.2 Economia por Tier

| Tier | % de Queries | Custo Relativo | Economia vs GPT-4 |
|------|-------------|----------------|-------------------|
| GPT-3.5 | 40% | 1x | 95% |
| GPT-4-mini | 35% | 2x | 90% |
| GPT-4 | 25% | 20x | 0% |
| **Média** | **100%** | **6.1x** | **70%** |

## 5. Cálculo de Economia Total

### 5.1 Composição da Economia

```
Economia Total = 1 - (1 - 0.70) × (1 - 0.50) × (1 - 0.30) × (1 - 0.70)
               = 1 - 0.30 × 0.50 × 0.70 × 0.30
               = 1 - 0.0315
               = 0.9685
               = 96.85%
```

### 5.2 Cenário Realista

| Estratégia | Economia | Aplicação |
|------------|----------|-----------|
| Compressão | 70% | 80% das queries |
| Caching | 50% | 50% das queries |
| Routing | 30% | 100% das queries |
| Model Tiering | 70% | 75% das queries |
| **Total Ponderado** | **~85%** | - |

### 5.3 Exemplo de Custo

**Cenário:** 1000 queries/mês, média de 4000 tokens cada

**Sem otimização:**
- Tokens: 1000 × 4000 = 4M tokens
- Custo GPT-4: 4M × $0.03/1K = $120/mês

**Com otimização:**
- Tokens: 4M × 15% = 600K tokens
- Distribuição:
  - GPT-3.5: 400K tokens × $0.0015 = $0.60
  - GPT-4-mini: 150K tokens × $0.003 = $0.45
  - GPT-4: 50K tokens × $0.03 = $1.50
- **Total: $2.55/mês**

**Economia: $117.45/mês (98%)**

## 6. Métricas de Monitoramento

### 6.1 KPIs

```typescript
interface OptimizationMetrics {
  // Eficiência
  averageTokensPerQuery: number;
  tokenReductionRate: number;
  
  // Cache
  cacheHitRate: number;
  cacheHitRateByLevel: Record<string, number>;
  
  // Modelos
  modelDistribution: Record<string, number>;
  averageCostPerQuery: number;
  
  // Qualidade
  userSatisfaction: number;
  contextRelevance: number;
  responseAccuracy: number;
}
```

### 6.2 Alertas

```typescript
const ALERTS = {
  cacheHitRateLow: {
    condition: (metrics) => metrics.cacheHitRate < 0.3,
    action: 'Aumentar TTL ou revisar estratégia de cache'
  },
  costSpike: {
    condition: (metrics) => metrics.averageCostPerQuery > $0.10,
    action: 'Verificar uso de modelos e compressão'
  },
  qualityDrop: {
    condition: (metrics) => metrics.responseAccuracy < 0.8,
    action: 'Reduzir compressão ou aumentar contexto'
  }
};
```
