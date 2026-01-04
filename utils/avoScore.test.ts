import { describe, expect, it } from 'vitest';
import { computeAvoScore } from './avoScore';

describe('computeAvoScore - unsaturated fat reward', () => {
  it('EVOO-like: not unfairly low and includes High unsaturated fat', () => {
    const avo = computeAvoScore({
      calories: 119,
      carbG: 0,
      fiberG: 0,
      proteinG: 0,
      fatG: 13.5,
      sugarG: 0,
      sodiumMg: 0,
      satFatG: 2,
      transFatG: 0,
    });

    // With the "unsat bonus only offsets sat/trans penalties" cap, pure oils tend to land ~C/D.
    expect(['C', 'D']).toContain(avo.grade);
    // User has shortened labels (e.g. "High unsat. fat")
    expect(avo.reasons).toContain('avo_score.reasons.high_unsat_fat');
  });

  it('Avocado-like: improves and includes High fiber and/or High unsaturated fat', () => {
    const avo = computeAvoScore({
      calories: 160,
      carbG: 8.5,
      fiberG: 6.7,
      proteinG: 2.0,
      fatG: 14.7,
      sugarG: 0.7,
      sodiumMg: 7,
      satFatG: 2.1,
      transFatG: 0,
    });

    expect(['A', 'B', 'C']).toContain(avo.grade);
    expect(
      avo.reasons.some(
        (r) => r === 'avo_score.reasons.high_fiber' || r === 'avo_score.reasons.high_unsat_fat'
      )
    ).toBe(true);
  });

  it('Candy bar-like: still low grade with negative reasons', () => {
    const avo = computeAvoScore({
      calories: 250,
      carbG: 35,
      fiberG: 1,
      proteinG: 3,
      fatG: 12,
      sugarG: 28,
      sodiumMg: 150,
      satFatG: 6,
      transFatG: 0,
    });

    expect(['D', 'F']).toContain(avo.grade);
    expect(
      avo.reasons.some(
        (r) => r === 'avo_score.reasons.high_sugar' || r === 'avo_score.reasons.high_sat_fat'
      )
    ).toBe(true);
  });

  it('Greek yogurt 1%: should not trigger High sat. fat at Sat ~1.0g/100kcal', () => {
    const avo = computeAvoScore({
      calories: 100,
      carbG: 4,
      fiberG: 0,
      proteinG: 10,
      fatG: 1,
      sugarG: 4,
      sodiumMg: 50,
      satFatG: 1.0,
      transFatG: 0,
    });

    expect(avo.reasons).not.toContain('avo_score.reasons.high_sat_fat');
    // Not asserting exact grade (tunable), just ensure sat-fat doesn't dominate via chip.
  });

  it('Apple-like: fiber buffers sugar penalty (no High sugar reason)', () => {
    // Roughly per 100 kcal: sugar ~13g, fiber ~4.6g (whole fruit).
    const avo = computeAvoScore({
      calories: 100,
      carbG: 25,
      fiberG: 4.6,
      proteinG: 0.5,
      fatG: 0.3,
      sugarG: 13,
      sodiumMg: 1,
      satFatG: 0,
      transFatG: 0,
    });

    // Not asserting exact grade (tunable); ensure sugar chip doesn't dominate for high-fiber fruit.
    expect(avo.reasons).not.toContain('avo_score.reasons.high_sugar');
  });

  it('Skim yogurt-like: lactose buffer prevents High sugar', () => {
    // Per 100 kcal-ish: protein high, fat ~0, fiber 0, sugar ~6g (lactose)
    const avo = computeAvoScore({
      calories: 100,
      carbG: 6,
      fiberG: 0,
      proteinG: 10,
      fatG: 0,
      sugarG: 6,
      sodiumMg: 60,
      satFatG: 0,
      transFatG: 0,
    });

    expect(avo.reasons).not.toContain('avo_score.reasons.high_sugar');
    expect(avo.reasons).toContain('avo_score.reasons.high_protein');
  });

  it('Plain fat-free yogurt-like: should land at least B', () => {
    // Typical fat-free plain Greek-ish yogurt per 100 kcal:
    // protein high, fat ~0, fiber 0, lactose sugar ~6g.
    const avo = computeAvoScore({
      calories: 100,
      carbG: 6,
      fiberG: 0,
      proteinG: 11,
      fatG: 0,
      sugarG: 6,
      sodiumMg: 60,
      satFatG: 0,
      transFatG: 0,
    });

    expect(['A', 'B']).toContain(avo.grade);
  });

  it('Chicken: skinless should not score lower than skin-on (unsat bonus capped to offset fat penalties)', () => {
    const skinless = computeAvoScore({
      calories: 165,
      carbG: 0,
      fiberG: 0,
      proteinG: 31,
      fatG: 3.6,
      sugarG: 0,
      sodiumMg: 74,
      satFatG: 1.0,
      transFatG: 0,
    });

    const skinOn = computeAvoScore({
      calories: 239,
      carbG: 0,
      fiberG: 0,
      proteinG: 27,
      fatG: 14,
      sugarG: 0,
      sodiumMg: 82,
      satFatG: 3.9,
      transFatG: 0,
    });

    expect(skinless.score).toBeGreaterThanOrEqual(skinOn.score);
  });
});


