/**
 * Pricing table for cost calculation (§2.4 of architecture doc).
 * Stored as a JSON map keyed by model ID so that unrecognised models
 * fall back to a warning rather than silently producing $0.00 costs.
 *
 * All rates are USD per million tokens.
 * Divide by 1,000,000 to get per-token rate for multiplication.
 *
 * Last updated: 2026-11-01 (CGUI-143: added claude-sonnet-5-5,
 * claude-haiku-5-5 with its long-context tier, claude-mythos-5-1,
 * claude-mythos-5, claude-opus-4-5, claude-sonnet-4-5 and the dateless
 * claude-haiku-4-5 alias; every rate verified against
 * platform.claude.com/docs/en/about-claude/pricing on 2026-11-01)
 */

export interface ModelRates {
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

/**
 * Higher rates for requests whose prompt is over `thresholdTokens` (CGUI-143).
 * Prompt length counts every input token of the request: uncached input,
 * cache reads and cache writes. Each request is priced on its own, so this
 * can only be applied per request, never to a session's summed totals.
 */
export interface LongContextTier extends ModelRates {
  thresholdTokens: number;
}

export interface ModelPricing extends ModelRates {
  /** Present only on models priced by prompt length (Haiku 5.5). */
  longContext?: LongContextTier;
}

const HAIKU_4_5: ModelPricing = {
  inputPerMillion: 1.0,
  outputPerMillion: 5.0,
  cacheWritePerMillion: 1.25,
  cacheReadPerMillion: 0.1,
  cacheWrite1hPerMillion: 2.0, // 2× input price
};

export const PRICING_TABLE: Record<string, ModelPricing> = {
  // Cache reads on Fable 5.1 are 0.025× input (not the standard 0.1×) —
  // $0.25/MTok, per the pricing page's footnote.
  'claude-fable-5-1': {
    inputPerMillion: 10.0,
    outputPerMillion: 50.0,
    cacheWritePerMillion: 12.5,
    cacheReadPerMillion: 0.25,
    cacheWrite1hPerMillion: 20.0, // 2× input price
  },
  // Limited-availability (Project Glasswing) twin of Fable 5.1: same rates,
  // including the 0.025× cache-read rate.
  'claude-mythos-5-1': {
    inputPerMillion: 10.0,
    outputPerMillion: 50.0,
    cacheWritePerMillion: 12.5,
    cacheReadPerMillion: 0.25,
    cacheWrite1hPerMillion: 20.0, // 2× input price
  },
  'claude-fable-5': {
    inputPerMillion: 10.0,
    outputPerMillion: 50.0,
    cacheWritePerMillion: 12.5,
    cacheReadPerMillion: 1.0,
    cacheWrite1hPerMillion: 20.0, // 2× input price
  },
  'claude-mythos-5': {
    inputPerMillion: 10.0,
    outputPerMillion: 50.0,
    cacheWritePerMillion: 12.5,
    cacheReadPerMillion: 1.0,
    cacheWrite1hPerMillion: 20.0, // 2× input price
  },
  // Opus 5.5 launched below Opus 5 ($4/$20). Cache reads are 0.05× input
  // ($0.20) per the pricing page's footnote; cache writes are the standard
  // 1.25× / 2× (CGUI-137).
  'claude-opus-5-5': {
    inputPerMillion: 4.0,
    outputPerMillion: 20.0,
    cacheWritePerMillion: 5.0,
    cacheReadPerMillion: 0.2,
    cacheWrite1hPerMillion: 8.0, // 2× input price
  },
  // Same input/output as Sonnet 5, but cache reads are 0.05× input ($0.10),
  // half of Sonnet 5's (CGUI-143).
  'claude-sonnet-5-5': {
    inputPerMillion: 2.0,
    outputPerMillion: 10.0,
    cacheWritePerMillion: 2.5,
    cacheReadPerMillion: 0.1,
    cacheWrite1hPerMillion: 4.0, // 2× input price
  },
  // $2/$10 launched as introductory pricing through 2026-08-31, but the
  // scheduled increase to $3/$15 was cancelled — the pricing page now
  // states these are the standard rates (CGUI-56, verified 2026-09-05).
  'claude-sonnet-5': {
    inputPerMillion: 2.0,
    outputPerMillion: 10.0,
    cacheWritePerMillion: 2.5,
    cacheReadPerMillion: 0.2,
    cacheWrite1hPerMillion: 4.0, // 2× input price
  },
  'claude-opus-5': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    cacheWrite1hPerMillion: 10.0, // 2× input price
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
  'claude-opus-4-5': {
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
  'claude-sonnet-4-5': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    cacheWrite1hPerMillion: 6.0, // 2× input price
  },
  // Priced by prompt length (CGUI-143): requests whose prompt is over 100K
  // tokens pay 5× on every rate. The only tiered model on the pricing page.
  'claude-haiku-5-5': {
    inputPerMillion: 0.1,
    outputPerMillion: 0.5,
    cacheWritePerMillion: 0.125,
    cacheReadPerMillion: 0.01,
    cacheWrite1hPerMillion: 0.2, // 2× input price
    longContext: {
      thresholdTokens: 100_000,
      inputPerMillion: 0.5,
      outputPerMillion: 2.5,
      cacheWritePerMillion: 0.625,
      cacheReadPerMillion: 0.05,
      cacheWrite1hPerMillion: 1.0, // 2× input price
    },
  },
  'claude-haiku-4-5-20251001': HAIKU_4_5,
  // Haiku 4.5 predates dateless IDs: the alias and the dated snapshot are
  // the same model, and either can appear in a transcript.
  'claude-haiku-4-5': HAIKU_4_5,
};

/** Returns the pricing entry for a model, or null if the model is unrecognised. */
export function getPricing(modelId: string): ModelPricing | null {
  return PRICING_TABLE[modelId] ?? null;
}
