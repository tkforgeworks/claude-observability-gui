import { getPricing, PRICING_TABLE, ModelPricing } from '../config/pricing';

describe('PRICING_TABLE', () => {
  it('should contain entries for all expected models', () => {
    expect(Object.keys(PRICING_TABLE)).toEqual(
      expect.arrayContaining([
        'claude-opus-4-6',
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
