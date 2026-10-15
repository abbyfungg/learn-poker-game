import { describe, expect, it } from 'vitest';
import { parseCards } from '../engine/cards';
import { handStrength } from '../coach/handStrength';
import { STARTING } from './HandGuide';

describe('hand guide examples', () => {
  it('every starting-hand example is rated in the group it is shown under', () => {
    for (const tier of STARTING) {
      for (const ex of tier.examples) expect([ex, handStrength(parseCards(ex), [], 1).level]).toEqual([ex, tier.level]);
    }
  });
});
