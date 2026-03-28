/**
 * Cost calculation for Claude Code sessions.
 * @see §2.4 of architecture doc for formula and pricing notes
 */

import { getPricing } from '../config/pricing';

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  /** Optional: 1-hour cache write tokens, if distinguishable from the 5-min tier */
  cacheCreation1hTokens?: number;
}

export interface CostResult {
  costUsd: number;
  modelRecognised: boolean;
}

/**
 * Computes cost_usd for a single session from its token counts and model ID.
 *
 * If the model is not in the pricing table, logs a warning and returns
 * costUsd: 0 with modelRecognised: false rather than silently producing $0.
 *
 * Formula:
 *   cost = (input_tokens × input_rate)
 *         + (output_tokens × output_rate)
 *         + (cache_creation_tokens × cache_write_rate)
 *         + (cache_read_tokens × cache_read_rate)
 *
 * @see §2.4 "Cache write tier note" for 1-hour vs 5-minute distinction
 */
export function calculateCost(model: string, tokens: TokenCounts): CostResult {
  // TODO: implement
  // 1. Look up pricing = getPricing(model)
  // 2. If null, log warning and return { costUsd: 0, modelRecognised: false }
  // 3. Apply formula: divide each per-million rate by 1_000_000 then multiply by token count
  // 4. If cacheCreation1hTokens present, apply cacheWrite1hPerMillion for that portion
  // 5. Sum all terms and return { costUsd, modelRecognised: true }
  throw new Error('calculateCost not yet implemented');
}

/**
 * Recalculates cost_usd for a set of existing session records.
 * Used by the "Recalculate costs" action in Settings > Data.
 */
export function recalculateCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
  cacheCreationTokens: number | null,
  cacheReadTokens: number | null
): number | null {
  // TODO: implement
  // Guard against nulls — return null if model is null or all token counts are null
  // Call calculateCost with coerced values and return costUsd
  throw new Error('recalculateCost not yet implemented');
}
