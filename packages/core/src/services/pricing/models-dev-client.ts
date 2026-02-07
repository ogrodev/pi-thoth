/**
 * Client for fetching model pricing from models.dev API
 * 
 * API: https://models.dev/api.json
 * Returns real-time pricing for 1900+ models from multiple providers
 */

import { logger } from '@th0th/shared';

export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  family?: string;
  /** Input cost per 1M tokens (in USD) */
  inputCostPerMillion: number;
  /** Output cost per 1M tokens (in USD) */
  outputCostPerMillion: number;
  /** Cache read cost per 1M tokens (optional) */
  cacheReadCostPerMillion?: number;
  /** Context window size */
  contextWindow?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
  /** Last updated timestamp */
  lastUpdated?: string;
}

export interface ModelsDevResponse {
  [providerId: string]: {
    id: string;
    name: string;
    models: {
      [modelId: string]: {
        id: string;
        name: string;
        family?: string;
        cost: {
          input: number;
          output: number;
          cache_read?: number;
        };
        limit?: {
          context?: number;
          output?: number;
        };
        last_updated?: string;
      };
    };
  };
}

export class ModelsDevClient {
  private static readonly API_URL = 'https://models.dev/api.json';
  private static readonly CACHE_TTL = 3600 * 1000; // 1 hour
  
  private cache: Map<string, ModelPricing> | null = null;
  private cacheTimestamp = 0;
  
  /**
   * Fetch all models with pricing from models.dev API
   */
  async fetchAllModels(): Promise<Map<string, ModelPricing>> {
    // Check cache
    if (this.cache && Date.now() - this.cacheTimestamp < ModelsDevClient.CACHE_TTL) {
      logger.debug('Using cached models.dev pricing data');
      return this.cache;
    }
    
    try {
      logger.info('Fetching pricing data from models.dev API');
      
      const response = await fetch(ModelsDevClient.API_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = (await response.json()) as ModelsDevResponse;
      
      // Parse and normalize
      const models = new Map<string, ModelPricing>();
      let totalModels = 0;
      let modelsWithPricing = 0;
      
      for (const [providerId, provider] of Object.entries(data)) {
        for (const [modelId, model] of Object.entries(provider.models || {})) {
          totalModels++;
          
          const cost = model.cost || { input: 0, output: 0 };
          
          // Skip models with zero cost (free/unknown pricing)
          if (cost.input === 0 && cost.output === 0) {
            continue;
          }
          
          modelsWithPricing++;
          
          // Normalize model ID (remove provider prefix if present)
          const normalizedId = this.normalizeModelId(modelId);
          
          // Convert from per-token to per-million tokens
          const pricing: ModelPricing = {
            id: normalizedId,
            name: model.name || modelId,
            provider: provider.name || providerId,
            family: model.family,
            inputCostPerMillion: cost.input,
            outputCostPerMillion: cost.output,
            cacheReadCostPerMillion: cost.cache_read,
            contextWindow: model.limit?.context,
            maxOutputTokens: model.limit?.output,
            lastUpdated: model.last_updated,
          };
          
          // Store with both original and normalized IDs
          models.set(modelId, pricing);
          if (normalizedId !== modelId) {
            models.set(normalizedId, pricing);
          }
          
          // Also store common aliases
          this.addCommonAliases(models, modelId, pricing);
        }
      }
      
      logger.info(`Loaded ${modelsWithPricing} models with pricing (out of ${totalModels} total)`);
      
      // Update cache
      this.cache = models;
      this.cacheTimestamp = Date.now();
      
      return models;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to fetch models.dev pricing', err);
      
      // Return cached data if available, even if expired
      if (this.cache) {
        logger.warn('Using expired cache due to fetch error');
        return this.cache;
      }
      
      throw err;
    }
  }
  
  /**
   * Get pricing for a specific model
   */
  async getModelPricing(modelId: string): Promise<ModelPricing | null> {
    const models = await this.fetchAllModels();
    
    // Try exact match
    let pricing = models.get(modelId);
    if (pricing) return pricing;
    
    // Try normalized ID
    const normalized = this.normalizeModelId(modelId);
    pricing = models.get(normalized);
    if (pricing) return pricing;
    
    // Try case-insensitive search
    const lowerModelId = modelId.toLowerCase();
    for (const [key, value] of models.entries()) {
      if (key.toLowerCase() === lowerModelId) {
        return value;
      }
    }
    
    logger.warn(`Model pricing not found: ${modelId}`);
    return null;
  }
  
  /**
   * Search models by name, provider, or family
   */
  async searchModels(query: string): Promise<ModelPricing[]> {
    const models = await this.fetchAllModels();
    const lowerQuery = query.toLowerCase();
    
    const results: ModelPricing[] = [];
    const seen = new Set<string>();
    
    for (const pricing of models.values()) {
      // Skip duplicates (same model with different IDs)
      const key = `${pricing.provider}:${pricing.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Search in ID, name, provider, family
      if (
        pricing.id.toLowerCase().includes(lowerQuery) ||
        pricing.name.toLowerCase().includes(lowerQuery) ||
        pricing.provider.toLowerCase().includes(lowerQuery) ||
        (pricing.family && pricing.family.toLowerCase().includes(lowerQuery))
      ) {
        results.push(pricing);
      }
    }
    
    // Sort by input cost (descending)
    results.sort((a, b) => b.inputCostPerMillion - a.inputCostPerMillion);
    
    return results;
  }
  
  /**
   * Get top N most expensive models
   */
  async getTopExpensiveModels(limit = 10): Promise<ModelPricing[]> {
    const models = await this.fetchAllModels();
    
    const unique = new Map<string, ModelPricing>();
    for (const pricing of models.values()) {
      const key = `${pricing.provider}:${pricing.name}`;
      if (!unique.has(key)) {
        unique.set(key, pricing);
      }
    }
    
    return Array.from(unique.values())
      .sort((a, b) => b.inputCostPerMillion - a.inputCostPerMillion)
      .slice(0, limit);
  }
  
  /**
   * Get statistics about available models
   */
  async getStatistics(): Promise<{
    totalModels: number;
    totalProviders: number;
    avgInputCost: number;
    avgOutputCost: number;
    cheapestModel: ModelPricing | null;
    mostExpensiveModel: ModelPricing | null;
  }> {
    const models = await this.fetchAllModels();
    
    const unique = new Map<string, ModelPricing>();
    const providers = new Set<string>();
    
    let totalInputCost = 0;
    let totalOutputCost = 0;
    
    for (const pricing of models.values()) {
      const key = `${pricing.provider}:${pricing.name}`;
      if (!unique.has(key)) {
        unique.set(key, pricing);
        providers.add(pricing.provider);
        totalInputCost += pricing.inputCostPerMillion;
        totalOutputCost += pricing.outputCostPerMillion;
      }
    }
    
    const modelList = Array.from(unique.values());
    modelList.sort((a, b) => a.inputCostPerMillion - b.inputCostPerMillion);
    
    return {
      totalModels: modelList.length,
      totalProviders: providers.size,
      avgInputCost: totalInputCost / modelList.length,
      avgOutputCost: totalOutputCost / modelList.length,
      cheapestModel: modelList[0] || null,
      mostExpensiveModel: modelList[modelList.length - 1] || null,
    };
  }
  
  /**
   * Normalize model ID (remove provider prefix, standardize format)
   */
  private normalizeModelId(modelId: string): string {
    // Remove common provider prefixes
    let normalized = modelId
      .replace(/^(openai|anthropic|google|meta|mistral|cohere)\//i, '')
      .replace(/^(claude-|gpt-|gemini-|llama-)/i, (match) => match.toLowerCase());
    
    return normalized;
  }
  
  /**
   * Add common aliases for a model
   */
  private addCommonAliases(
    models: Map<string, ModelPricing>,
    modelId: string,
    pricing: ModelPricing
  ): void {
    // GPT-4 aliases
    if (modelId.includes('gpt-4') && !modelId.includes('turbo')) {
      models.set('gpt-4', pricing);
    }
    if (modelId.includes('gpt-4-turbo')) {
      models.set('gpt-4-turbo', pricing);
    }
    if (modelId.includes('gpt-3.5-turbo')) {
      models.set('gpt-3.5-turbo', pricing);
    }
    
    // Claude aliases
    if (modelId.includes('claude-3-opus')) {
      models.set('claude-3-opus', pricing);
    }
    if (modelId.includes('claude-3-sonnet')) {
      models.set('claude-3-sonnet', pricing);
    }
    if (modelId.includes('claude-3-haiku')) {
      models.set('claude-3-haiku', pricing);
    }
    
    // Gemini aliases
    if (modelId.includes('gemini-pro')) {
      models.set('gemini-pro', pricing);
    }
    if (modelId.includes('gemini-1.5-pro')) {
      models.set('gemini-1.5-pro', pricing);
    }
    if (modelId.includes('gemini-1.5-flash')) {
      models.set('gemini-1.5-flash', pricing);
    }
  }
  
  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
    logger.debug('Models.dev pricing cache cleared');
  }
}

// Singleton instance
let clientInstance: ModelsDevClient | null = null;

/**
 * Get the shared ModelsDevClient instance
 */
export function getModelsDevClient(): ModelsDevClient {
  if (!clientInstance) {
    clientInstance = new ModelsDevClient();
  }
  return clientInstance;
}
