import { calculateCost, recalculateCost, TokenCounts } from '../importers/costCalculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a TokenCounts object with sensible zero defaults. */
function tokens(overrides: Partial<TokenCounts> = {}): TokenCounts {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateCost
// ---------------------------------------------------------------------------

describe('calculateCost', () => {
  describe('when model is unrecognised', () => {
    it('should return modelRecognised: false for an unknown model', () => {
      const result = calculateCost('claude-unknown-x', tokens({ inputTokens: 1000 }));
      expect(result.modelRecognised).toBe(false);
    });

    it('should return costUsd: 0 for an unknown model', () => {
      const result = calculateCost('claude-unknown-x', tokens({ inputTokens: 1000 }));
      expect(result.costUsd).toBe(0);
    });
  });

  describe('when session has zero tokens', () => {
    it('should return $0.00 for all-zero token counts on a known model', () => {
      const result = calculateCost('claude-sonnet-4-6', tokens());
      expect(result.costUsd).toBe(0);
      expect(result.modelRecognised).toBe(true);
    });
  });

  describe('when model is claude-sonnet-4-6 with known token counts', () => {
    /**
     * Rates for claude-sonnet-4-6:
     *   input       $3.00 / 1M
     *   output      $15.00 / 1M
     *   cacheWrite  $3.75 / 1M  (5-min TTL)
     *   cacheRead   $0.30 / 1M
     *
     * Token counts:
     *   input            1,000,000  →  $3.000000
     *   output             500,000  →  $7.500000
     *   cacheCreation      100,000  →  $0.375000
     *   cacheRead          200,000  →  $0.060000
     *                               ──────────
     *   total                          $10.935000
     */
    const TEST_TOKENS = tokens({
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheCreationTokens: 100_000,
      cacheReadTokens: 200_000,
    });

    it('should return modelRecognised: true', () => {
      const result = calculateCost('claude-sonnet-4-6', TEST_TOKENS);
      expect(result.modelRecognised).toBe(true);
    });

    it('should produce the correct total cost', () => {
      const result = calculateCost('claude-sonnet-4-6', TEST_TOKENS);
      expect(result.costUsd).toBeCloseTo(10.935, 6);
    });
  });

  describe('cache tier split (5-min and 1-hour TTL tokens)', () => {
    /**
     * Rates for claude-sonnet-4-6:
     *   cacheWrite5m   $3.75 / 1M
     *   cacheWrite1h   $6.00 / 1M
     *
     * Token counts:
     *   cacheCreationTokens    300,000  (total)
     *   cacheCreation1hTokens  200,000  → $6.00 * 0.2  = $1.200000
     *   fiveMinTokens          100,000  → $3.75 * 0.1  = $0.375000
     *   cacheWriteCost                               = $1.575000
     *
     * Other counts are zero, so total cost = $1.575000
     */
    it('should split cache write cost across the 5m and 1h tiers', () => {
      const result = calculateCost(
        'claude-sonnet-4-6',
        tokens({
          cacheCreationTokens: 300_000,
          cacheCreation1hTokens: 200_000,
        })
      );
      expect(result.costUsd).toBeCloseTo(1.575, 6);
      expect(result.modelRecognised).toBe(true);
    });

    it('should fall back to the 5m rate when cacheCreation1hTokens is 0', () => {
      // cacheCreation1hTokens === 0 is falsy — branch uses flat cacheWritePerMillion
      const result = calculateCost(
        'claude-sonnet-4-6',
        tokens({
          cacheCreationTokens: 300_000,
          cacheCreation1hTokens: 0,
        })
      );
      // 300,000 / 1M * $3.75 = $1.125
      expect(result.costUsd).toBeCloseTo(1.125, 6);
    });

    it('should fall back to the 5m rate when cacheCreation1hTokens is omitted', () => {
      const result = calculateCost(
        'claude-sonnet-4-6',
        tokens({ cacheCreationTokens: 300_000 })
      );
      expect(result.costUsd).toBeCloseTo(1.125, 6);
    });
  });

  describe('component cost isolation', () => {
    it('should charge only input cost when only input tokens are present', () => {
      // 2,000,000 input * $3.00 / 1M = $6.00
      const result = calculateCost('claude-sonnet-4-6', tokens({ inputTokens: 2_000_000 }));
      expect(result.costUsd).toBeCloseTo(6.0, 6);
    });

    it('should charge only output cost when only output tokens are present', () => {
      // 1,000,000 output * $15.00 / 1M = $15.00
      const result = calculateCost('claude-sonnet-4-6', tokens({ outputTokens: 1_000_000 }));
      expect(result.costUsd).toBeCloseTo(15.0, 6);
    });

    it('should charge only cache-read cost when only cache read tokens are present', () => {
      // 1,000,000 cacheRead * $0.30 / 1M = $0.30
      const result = calculateCost('claude-sonnet-4-6', tokens({ cacheReadTokens: 1_000_000 }));
      expect(result.costUsd).toBeCloseTo(0.3, 6);
    });
  });
});

// ---------------------------------------------------------------------------
// recalculateCost
// ---------------------------------------------------------------------------

describe('recalculateCost', () => {
  describe('null / missing model', () => {
    it('should return null when model is null', () => {
      expect(recalculateCost(null, 1000, 500, 0, 0)).toBeNull();
    });

    it('should return null when model is an empty string', () => {
      expect(recalculateCost('', 1000, 500, 0, 0)).toBeNull();
    });
  });

  describe('unrecognised model', () => {
    it('should return null when model is not in the pricing table', () => {
      expect(recalculateCost('claude-unknown-x', 1000, 500, 0, 0)).toBeNull();
    });
  });

  describe('all token counts are null', () => {
    it('should return null when every token field is null', () => {
      expect(recalculateCost('claude-sonnet-4-6', null, null, null, null)).toBeNull();
    });
  });

  describe('partial null token counts', () => {
    it('should treat null token fields as 0 and compute a cost', () => {
      // Only outputTokens provided: 1,000,000 * $15 = $15.00
      const result = recalculateCost('claude-sonnet-4-6', null, 1_000_000, null, null);
      expect(result).toBeCloseTo(15.0, 6);
    });

    it('should return a numeric cost when at least one token field is non-null', () => {
      const result = recalculateCost('claude-sonnet-4-6', 1_000_000, null, null, null);
      // 1M input * $3 = $3.00
      expect(result).toBeCloseTo(3.0, 6);
    });
  });

  describe('known model with all token counts provided', () => {
    it('should return the correct cost for claude-sonnet-4-6', () => {
      // 1M input ($3) + 500k output ($7.5) + 100k cacheCreation ($0.375) + 200k cacheRead ($0.06) = $10.935
      const result = recalculateCost('claude-sonnet-4-6', 1_000_000, 500_000, 100_000, 200_000);
      expect(result).toBeCloseTo(10.935, 6);
    });

    it('should return 0 for a zero-token session on a known model', () => {
      expect(recalculateCost('claude-sonnet-4-6', 0, 0, 0, 0)).toBe(0);
    });
  });
});
