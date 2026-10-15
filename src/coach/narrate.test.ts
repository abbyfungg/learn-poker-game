import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/cards';
import { applyAction, startHand } from '../engine/game';
import { table } from '../engine/testUtils';
import { narrate } from './narrate';

describe('play-by-play narration', () => {
  it('explains blinds, raises and what the player can do', () => {
    let s = startHand(table([1000, 1000, 1000]), createRng(1)); // seat 0 = you, on the button
    let n = narrate(s, 0);
    expect(n.street).toMatch(/Pre-flop/);
    expect(n.lines[0]).toMatch(/P1 posted the small blind \(5\)/);
    expect(n.prompt).toMatch(/costs 10 to keep playing/);
    s = applyAction(s, { type: 'raise', amount: 30 });
    n = narrate(s, 0);
    expect(n.lines.at(-1)).toMatch(/^You raised to 30/);
    expect(n.prompt).toBeUndefined();
  });

  it('offers a free check when nobody has bet', () => {
    let s = startHand(table([1000, 1000, 1000]), createRng(1));
    s = applyAction(s, { type: 'call' });
    s = applyAction(s, { type: 'call' });
    const n = narrate(s, 2);
    expect(n.prompt).toMatch(/check for free/);
  });
});
