import { getPricing, PRICING_TABLE, ModelPricing } from '../config/pricing';

describe('PRICING_TABLE', () => {
  it('should contain entries for all expected models', () => {
    expect(Object.keys(PRICING_TABLE)).toEqual(
      expect.arrayContaining([
        'claude-fable-5-1',
        'claude-fable-5',
        'claude-opus-5',
        'claude-opus-4-6',
        'claude-sonnet-5',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
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
