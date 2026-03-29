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
 * If the model is not in the pricing table, returns
 * costUsd: 0 with modelRecognised: false.
 */
export function calculateCost(model: string, tokens: TokenCounts): CostResult {
  const pricing = getPricing(model);
  if (!pricing) {
    console.warn(`[costCalculator] Unrecognised model: ${model}`);
    return { costUsd: 0, modelRecognised: false };
  }

  const inputCost = (tokens.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (tokens.outputTokens / 1_000_000) * pricing.outputPerMillion;
  const cacheReadCost = (tokens.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

  let cacheWriteCost: number;
  if (tokens.cacheCreation1hTokens && pricing.cacheWrite1hPerMillion) {
    // Split: 1h tokens at the 1h rate, remaining at the 5m rate
    const fiveMinTokens = tokens.cacheCreationTokens - tokens.cacheCreation1hTokens;
    cacheWriteCost =
      (fiveMinTokens / 1_000_000) * pricing.cacheWritePerMillion +
      (tokens.cacheCreation1hTokens / 1_000_000) * pricing.cacheWrite1hPerMillion;
  } else {
    cacheWriteCost = (tokens.cacheCreationTokens / 1_000_000) * pricing.cacheWritePerMillion;
  }

  const costUsd = inputCost + outputCost + cacheReadCost + cacheWriteCost;
  return { costUsd, modelRecognised: true };
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
  if (!model) return null;
  if (inputTokens == null && outputTokens == null && cacheCreationTokens == null && cacheReadTokens == null) {
    return null;
  }

  const result = calculateCost(model, {
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cacheCreationTokens: cacheCreationTokens ?? 0,
    cacheReadTokens: cacheReadTokens ?? 0,
  });

  return result.modelRecognised ? result.costUsd : null;
}
