/**
 * Pricing table for cost calculation (§2.4 of architecture doc).
 * Stored as a JSON map keyed by model ID so that unrecognised models
 * fall back to a warning rather than silently producing $0.00 costs.
 *
 * All rates are USD per million tokens.
 * Divide by 1,000,000 to get per-token rate for multiplication.
 *
 * Last updated: July 2026
 */

export interface ModelPricing {
  /** USD per million input tokens (non-cached) */
  inputPerMillion: number;
  /** USD per million output tokens */
  outputPerMillion: number;
  /** USD per million cache-write tokens (5-minute TTL) */
  cacheWritePerMillion: number;
  /** USD per million cache-read tokens */
  cacheReadPerMillion: number;
  /**
   * USD per million cache-write tokens (1-hour TTL).
   * If null, fall back to cacheWritePerMillion.
   * See §2.4: 1-hour rate is 2× input price.
   */
  cacheWrite1hPerMillion: number | null;
}

export const PRICING_TABLE: Record<string, ModelPricing> = {
  'claude-fable-5': {
    inputPerMillion: 10.0,
    outputPerMillion: 50.0,
    cacheWritePerMillion: 12.5,
    cacheReadPerMillion: 1.0,
    cacheWrite1hPerMillion: 20.0, // 2× input price
  },
  // Introductory pricing ($2/$10) through 2026-08-31; bump to $3/$15
  // (cache write 3.75, read 0.30, 1h 6.00) after that date.
  'claude-sonnet-5': {
    inputPerMillion: 2.0,
    outputPerMillion: 10.0,
    cacheWritePerMillion: 2.5,
    cacheReadPerMillion: 0.2,
    cacheWrite1hPerMillion: 4.0, // 2× input price
  },
  'claude-opus-4-8': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    cacheWrite1hPerMillion: 10.0, // 2× input price
  },
  'claude-opus-4-7': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    cacheWrite1hPerMillion: 10.0, // 2× input price
  },
  'claude-opus-4-6': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    cacheWrite1hPerMillion: 10.0, // 2× input price
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    cacheWrite1hPerMillion: 6.0, // 2× input price
  },
  'claude-haiku-4-5-20251001': {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cacheWritePerMillion: 1.25,
    cacheReadPerMillion: 0.1,
    cacheWrite1hPerMillion: 2.0, // 2× input price
  },
};

/** Returns the pricing entry for a model, or null if the model is unrecognised. */
export function getPricing(modelId: string): ModelPricing | null {
  return PRICING_TABLE[modelId] ?? null;
}
