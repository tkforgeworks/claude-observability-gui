import { getPricing, PRICING_TABLE, ModelPricing } from '../config/pricing';

describe('PRICING_TABLE', () => {
  it('should contain entries for all expected models', () => {
    expect(Object.keys(PRICING_TABLE)).toEqual(
      expect.arrayContaining([
        'claude-fable-5-1',
        'claude-fable-5',
        'claude-opus-5-5',
        'claude-opus-5',
        'claude-opus-4-6',
        'claude-sonnet-5',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
        // CGUI-143
        'claude-sonnet-5-5',
        'claude-haiku-5-5',
        'claude-mythos-5-1',
        'claude-mythos-5',
        'claude-opus-4-5',
        'claude-sonnet-4-5',
        'claude-haiku-4-5',
      ])
    );
  });

  it('should have no null cacheWrite1hPerMillion on any current model', () => {
    for (const [, pricing] of Object.entries(PRICING_TABLE)) {
      expect(pricing.cacheWrite1hPerMillion).not.toBeNull();
    }
  });
});

describe('getPricing', () => {
  describe('when model is known', () => {
    it('should return pricing for claude-sonnet-4-6', () => {
      const pricing = getPricing('claude-sonnet-4-6');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(3.0);
      expect(pricing!.outputPerMillion).toBe(15.0);
      expect(pricing!.cacheWritePerMillion).toBe(3.75);
      expect(pricing!.cacheReadPerMillion).toBe(0.3);
      expect(pricing!.cacheWrite1hPerMillion).toBe(6.0);
    });

    // CGUI-56: $2/$10 launched as introductory pricing, but the scheduled
    // 2026-09-01 increase to $3/$15 was cancelled — these ARE the standard
    // rates, verified against the live pricing page on 2026-09-05.
    it('should return standard (former introductory) pricing for claude-sonnet-5', () => {
      const pricing = getPricing('claude-sonnet-5');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(2.0);
      expect(pricing!.outputPerMillion).toBe(10.0);
      expect(pricing!.cacheWritePerMillion).toBe(2.5);
      expect(pricing!.cacheReadPerMillion).toBe(0.2);
      expect(pricing!.cacheWrite1hPerMillion).toBe(4.0);
    });

    it('should return pricing for claude-fable-5-1 with the 0.025x cache-read rate', () => {
      const pricing = getPricing('claude-fable-5-1');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(10.0);
      expect(pricing!.outputPerMillion).toBe(50.0);
      expect(pricing!.cacheWritePerMillion).toBe(12.5);
      // Fable 5.1 cache reads are 0.025x input, not the standard 0.1x
      expect(pricing!.cacheReadPerMillion).toBe(0.25);
      expect(pricing!.cacheWrite1hPerMillion).toBe(20.0);
    });

    it('should return pricing for claude-opus-5-5 (CGUI-137)', () => {
      const pricing = getPricing('claude-opus-5-5');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(4.0);
      expect(pricing!.outputPerMillion).toBe(20.0);
      expect(pricing!.cacheWritePerMillion).toBe(5.0);
      expect(pricing!.cacheReadPerMillion).toBe(0.2);
      expect(pricing!.cacheWrite1hPerMillion).toBe(8.0);
    });

    it('should return pricing for claude-opus-5', () => {
      const pricing = getPricing('claude-opus-5');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(5.0);
      expect(pricing!.outputPerMillion).toBe(25.0);
      expect(pricing!.cacheWritePerMillion).toBe(6.25);
      expect(pricing!.cacheReadPerMillion).toBe(0.5);
      expect(pricing!.cacheWrite1hPerMillion).toBe(10.0);
    });

    it('should return pricing for claude-opus-4-6', () => {
      const pricing = getPricing('claude-opus-4-6');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(5.0);
      expect(pricing!.outputPerMillion).toBe(25.0);
    });

    it('should return pricing for claude-haiku-4-5-20251001', () => {
      const pricing = getPricing('claude-haiku-4-5-20251001');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMillion).toBe(1.0);
      expect(pricing!.outputPerMillion).toBe(5.0);
    });
  });

  // CGUI-143: rates from platform.claude.com/docs/en/about-claude/pricing,
  // verified 2026-11-01. Order: input, 5m write, 1h write, cache read, output.
  describe('models added in CGUI-143', () => {
    const rates = (model: string) => {
      const p = getPricing(model);
      expect(p).not.toBeNull();
      return [
        p!.inputPerMillion,
        p!.cacheWritePerMillion,
        p!.cacheWrite1hPerMillion,
        p!.cacheReadPerMillion,
        p!.outputPerMillion,
      ];
    };

    it.each([
      ['claude-sonnet-5-5', [2, 2.5, 4, 0.1, 10]],
      ['claude-haiku-5-5', [0.1, 0.125, 0.2, 0.01, 0.5]],
      ['claude-mythos-5-1', [10, 12.5, 20, 0.25, 50]],
      ['claude-mythos-5', [10, 12.5, 20, 1, 50]],
      ['claude-opus-4-5', [5, 6.25, 10, 0.5, 25]],
      ['claude-sonnet-4-5', [3, 3.75, 6, 0.3, 15]],
      ['claude-haiku-4-5', [1, 1.25, 2, 0.1, 5]],
    ])('%s has the published rates', (model, expected) => {
      expect(rates(model)).toEqual(expected);
    });

    it('prices Haiku 5.5 prompts over 100K tokens at the long-context tier', () => {
      const tier = getPricing('claude-haiku-5-5')!.longContext;
      expect(tier).toBeDefined();
      expect(tier!.thresholdTokens).toBe(100_000);
      expect([
        tier!.inputPerMillion,
        tier!.cacheWritePerMillion,
        tier!.cacheWrite1hPerMillion,
        tier!.cacheReadPerMillion,
        tier!.outputPerMillion,
      ]).toEqual([0.5, 0.625, 1, 0.05, 2.5]);
    });

    it('gives the Haiku 4.5 alias and dated snapshot the same rates', () => {
      expect(getPricing('claude-haiku-4-5')).toEqual(getPricing('claude-haiku-4-5-20251001'));
    });

    it('gives no other model a long-context tier', () => {
      const tiered = Object.entries(PRICING_TABLE)
        .filter(([, p]) => p.longContext)
        .map(([m]) => m);
      expect(tiered).toEqual(['claude-haiku-5-5']);
    });
  });

  describe('when model is unrecognised', () => {
    it('should return null for an unknown model string', () => {
      expect(getPricing('claude-unknown-model')).toBeNull();
    });

    it('should return null for an empty string', () => {
      expect(getPricing('')).toBeNull();
    });

    it('should return null for a model ID with wrong casing', () => {
      expect(getPricing('Claude-Sonnet-4-6')).toBeNull();
    });
  });
});
