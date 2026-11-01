/**
 * Cost calculation for Claude Code sessions.
 * @see §2.4 of architecture doc for formula and pricing notes
 */

import { getPricing, ModelPricing, ModelRates } from '../config/pricing';

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

/** Input tokens a request sent: uncached input, cache reads and cache writes. */
export function promptTokens(tokens: TokenCounts): number {
  return tokens.inputTokens + tokens.cacheReadTokens + tokens.cacheCreationTokens;
}

/**
 * The rates one request pays: the long-context tier when the model has one and
 * the request's prompt is over its threshold, otherwise the base rates.
 */
export function ratesForRequest(pricing: ModelPricing, tokens: TokenCounts): ModelRates {
  const tier = pricing.longContext;
  return tier && promptTokens(tokens) > tier.thresholdTokens ? tier : pricing;
}

function costAtRates(rates: ModelRates, tokens: TokenCounts): number {
  const inputCost = (tokens.inputTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (tokens.outputTokens / 1_000_000) * rates.outputPerMillion;
  const cacheReadCost = (tokens.cacheReadTokens / 1_000_000) * rates.cacheReadPerMillion;

  let cacheWriteCost: number;
  if (tokens.cacheCreation1hTokens && rates.cacheWrite1hPerMillion) {
    // Split: 1h tokens at the 1h rate, remaining at the 5m rate
    const fiveMinTokens = tokens.cacheCreationTokens - tokens.cacheCreation1hTokens;
    cacheWriteCost =
      (fiveMinTokens / 1_000_000) * rates.cacheWritePerMillion +
      (tokens.cacheCreation1hTokens / 1_000_000) * rates.cacheWrite1hPerMillion;
  } else {
    cacheWriteCost = (tokens.cacheCreationTokens / 1_000_000) * rates.cacheWritePerMillion;
  }

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Cost of ONE API request. Picks the long-context tier from this request's own
 * prompt size (CGUI-143), so callers must pass a single request's usage —
 * summing requests first would push a session of small prompts into the
 * higher tier. Takes the already-resolved pricing so a per-request loop does
 * one lookup (and at most one unknown-model warning) per session.
 */
export function calculateRequestCost(pricing: ModelPricing, tokens: TokenCounts): number {
  return costAtRates(ratesForRequest(pricing, tokens), tokens);
}

/**
 * Computes cost_usd from token totals that may span many requests (stored
 * session or hour totals). Totals don't say how big each prompt was, so a
 * model with a long-context tier is priced at its base rates here — an
 * undercount for any request that crossed the threshold. The importer prices
 * per request with calculateRequestCost instead; this is the fallback for
 * rows whose transcripts are gone.
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
  return { costUsd: costAtRates(pricing, tokens), modelRecognised: true };
}

/**
 * Estimated USD saved by serving `cacheReadTokens` from the prompt cache
 * instead of as fresh input: tokens × (inputRate − cacheReadRate).
 *
 * Returns null for an unrecognised model (CGUI-109) — callers must treat
 * that as zero savings, never fall back to another model's rate. Logs the
 * same way calculateCost does so unknown models surface in one place.
 * Works on totals, so a tiered model's savings use its base rates (an
 * estimate, like the rest of this figure).
 */
export function calculateCacheSavings(model: string, cacheReadTokens: number): number | null {
  const pricing = getPricing(model);
  if (!pricing) {
    console.warn(`[costCalculator] Unrecognised model: ${model}`);
    return null;
  }
  return (cacheReadTokens / 1_000_000) * (pricing.inputPerMillion - pricing.cacheReadPerMillion);
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
