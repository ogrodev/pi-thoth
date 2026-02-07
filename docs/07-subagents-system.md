# Sistema de Subsagentes - MCP RLM

## Visão Geral da Arquitetura de Agentes

```
┌─────────────────────────────────────────────────────────────────┐
│              ORQUESTRADOR PRINCIPAL (Mistral)                    │                          │
│                    Provider: Mistral AI                          │
│                                                                  │
│  Responsabilidades:                                              │
│  • Receber tarefas do usuário                                    │
│  • Analisar e decompor em subtarefas                             │
│  • Selecionar subsagente apropriado                              │
│  • Coordenar execução                                            │
│  • Consolidar resultados                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   ARQUITETO     │ │  IMPLEMENTADOR  │ │   OTIMIZADOR    │
│   (Claude)      │ │    (GPT-4)      │ │    (Kimi)       │
│                 │ │                 │ │                 │
│ Model:          │ │ Model:          │ │ Model:          │
│ Claude 3.5      │ │ GPT-4 Turbo     │ │ Kimi k1.5       │
│ Sonnet          │ │                 │ │                 │
│                 │ │ Provider:       │ │ Provider:       │
│ Provider:       │ │ OpenAI          │ │ Moonshot AI     │
│ Anthropic       │ │                 │ │                 │
│                 │ │ Especialidade:  │ │ Especialidade:  │
│ Especialidade:  │ │ • Codificação   │ │ • Performance   │
│ • Design        │ │ • Debugging     │ │ • Economia      │
│ • Arquitetura   │ │ • Testes        │ │ • Compressão    │
│ • Patterns      │ │ • Integração    │ │ • Cache         │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Modelos Selecionados

| Agente | Modelo | Provider | Custo/1M tokens | Força |
|--------|--------|----------|-----------------|-------|
| **Orquestrador** |
| **Arquiteto** | Claude 3.5 Sonnet | Anthropic
| **Implementador** | GPT-5  | OpenAI |
| **Otimizador** | Kimi k2.5 |

## Por que essa distribuição?

### Orquestrador: Mistral 7B
- ✅ **Rápido e barato**: Ideal para tarefas de coordenação
- ✅ **Bom em decomposição**: Quebra tarefas complexas eficientemente
- ✅ **Baixo custo**: Pode rodar frequentemente sem custos altos
- ✅ **Contexto suficiente**: 32K tokens para orquestração

### Arquiteto: Claude 3.5 Sonnet
- ✅ **Excelente em design**: Melhor modelo para arquitetura de software
- ✅ **Contexto longo**: 200K tokens para análise completa
- ✅ **Raciocínio estruturado**: Ideal para patterns e abstrações
- ✅ **Custo moderado**: Balanceado para tarefas arquiteturais

### Implementador: GPT-4 Turbo
- ✅ **Melhor codificação**: Superior em gerar código funcional
- ✅ **Debugging excelente**: Identifica e corrige bugs eficientemente
- ✅ **Testes automáticos**: Gera testes de qualidade
- ✅ **Integração**: Melhor em conectar diferentes componentes

### Otimizador: Kimi k1.5
- ✅ **Especialista em long context**: 2M tokens para análise profunda
- ✅ **Otimização**: Focado em eficiência e performance
- ✅ **Economia**: Bem-sucedido em reduzir custos
- ✅ **Cache inteligente**: Estratégias avançadas de caching

## Protocolo de Comunicação

### Formato de Task do Orquestrador

```json
{
  "task_id": "uuid",
  "task_type": "architecture | implementation | optimization",
  "priority": "low | medium | high | critical",
  "context": {
    "project_state": "...",
    "dependencies": [...],
    "constraints": [...]
  },
  "requirements": {
    "functional": [...],
    "non_functional": [...]
  },
  "deliverables": [...],
  "estimated_effort": "hours",
  "parent_task": "uuid (optional)"
}
```

### Formato de Resposta do Subsagente

```json
{
  "task_id": "uuid",
  "status": "completed | partial | failed | blocked",
  "result": {
    "artifacts": [...],
    "code": "...",
    "documentation": "...",
    "tests": [...]
  },
  "metrics": {
    "tokens_used": 1234,
    "quality_score": 0.95
  },
  "next_steps": [...],
  "blockers": [...]
}
```

## Workflows

### Workflow 1: Nova Feature

```
Usuário → Orquestrador (Mistral)
              │
              ├── Análise de requisitos
              │
              ▼
        Arquiteto (Claude)
              │
              ├── Design da solução
              ├── Definição de interfaces
              └── Documentação técnica
              │
              ▼
        Implementador (GPT-4)
              │
              ├── Código da feature
              ├── Testes unitários
              └── Integração
              │
              ▼
        Otimizador (Kimi)
              │
              ├── Refatoração
              ├── Otimização de performance
              └── Cache strategies
              │
              ▼
        Orquestrador (Mistral)
              │
              └── Consolidação e entrega
```

### Workflow 2: Bug Fix

```
Usuário → Orquestrador (Mistral)
              │
              ├── Classificação do bug
              │
              ▼
        Implementador (GPT-4)
              │
              ├── Análise do código
              ├── Identificação da causa
              └── Implementação do fix
              │
              ▼
        Otimizador (Kimi)
              │
              ├── Verificação de edge cases
              ├── Otimização do fix
              └── Testes de regressão
              │
              ▼
        Orquestrador (Mistral)
              │
              └── Validação e merge
```

### Workflow 3: Refatoração

```
Usuário → Orquestrador (Mistral)
              │
              ├── Análise do escopo
              │
              ▼
        Arquiteto (Claude)
              │
              ├── Novo design
              ├── Migração planejada
              └── Riscos identificados
              │
              ▼
        Implementador (GPT-4)
              │
              ├── Refatoração do código
              ├── Atualização de testes
              └── Documentação
              │
              ▼
        Otimizador (Kimi)
              │
              ├── Análise de performance
              ├── Otimizações adicionais
              └── Benchmarks
              │
              ▼
        Orquestrador (Mistral)
              │
              └── Review final
```

## Prompts do Orquestrador

### Prompt de Seleção

```
Você é o Orquestrador Principal do sistema MCP RLM.

Sua tarefa é analisar solicitações do usuário e delegar para o subsagente apropriado.

AGENTES DISPONÍVEIS:
1. ARQUITETO (Claude 3.5 Sonnet) - Use para:
   - Design de arquitetura
   - Definição de patterns
   - Estrutura de dados
   - Interfaces e contratos
   - Documentação técnica

2. IMPLEMENTADOR (GPT-4 Turbo) - Use para:
   - Escrever código
   - Debugging
   - Testes
   - Integração de componentes
   - Correções de bugs

3. OTIMIZADOR (Kimi k1.5) - Use para:
   - Performance tuning
   - Compressão de dados
   - Estratégias de cache
   - Redução de custos
   - Análise de eficiência

REGRAS:
- Se a tarefa envolver design/arquitetura → ARQUITETO
- Se a tarefa envolver código/testes → IMPLEMENTADOR
- Se a tarefa envolver performance/custo → OTIMIZADOR
- Se múltiplos, ordene: ARQUITETO → IMPLEMENTADOR → OTIMIZADOR

FORMATE SUA RESPOSTA COMO:
{
  "agent": "architect | implementer | optimizer",
  "task_decomposition": [...],
  "context": {...},
  "priority": "low | medium | high"
}
```

### Prompt de Consolidação

```
Você é o Orquestrador Principal.

Receba os resultados dos subsagentes e consolide em uma entrega coesa.

TAREFAS:
1. Verificar completude dos entregáveis
2. Identificar conflitos ou gaps
3. Solicitar esclarecimentos se necessário
4. Consolidar documentação
5. Preparar resumo para o usuário

SAÍDA ESPERADA:
- Resumo executivo
- Artefatos entregues
- Próximos passos recomendados
- Métricas de qualidade
```

## Monitoramento

### Métricas por Agente

```typescript
interface AgentMetrics {
  agent_id: string;
  model: string;
  tasks_completed: number;
  tasks_failed: number;
  average_tokens_per_task: number;
  average_cost_per_task: number;
  average_time_per_task: number;
  quality_score: number;
}
```
## Próximos Passos

1. Configurar conexões com APIs dos providers
2. Implementar protocolo de comunicação
3. Criar sistema de filas para tasks
4. Implementar monitoramento
5. Testar workflows end-to-end
