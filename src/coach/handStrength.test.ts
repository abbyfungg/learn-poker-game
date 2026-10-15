import { describe, expect, it } from 'vitest';
import { parseCards } from '../engine/cards';
import { HandCategory } from '../engine/evaluator';
import { handStrength, startingPercentile } from './handStrength';

const hs = (hole: string, board = '', opp = 1) => handStrength(parseCards(hole), board ? parseCards(board) : [], opp);

describe('hand strength for beginners', () => {
  it('rates aces as very strong and 7-2 offsuit as weak before the flop', () => {
    expect(hs('As Ad').level).toBe(4);
    expect(hs('As Ad').title).toBe('Pair of Aces');
    expect(hs('7c 2d').level).toBe(0);
    expect(hs('7c 2d').title).toBe('Seven-Two, different suits');
  });

  it('puts aces near the top and 7-2 near the bottom of all starting hands', () => {
    expect(startingPercentile(parseCards('As Ad'))).toBeGreaterThan(0.99);
    expect(startingPercentile(parseCards('7c 2d'))).toBeLessThan(0.15);
  });

  it('explains suited and connected cards', () => {
    const s = hs('9h 8h');
    expect(s.points.join(' ')).toMatch(/Same suit/);
    expect(s.points.join(' ')).toMatch(/straights/);
  });

  it('recognises top pair, overpair and board-only hands', () => {
    expect(hs('Kh 9c', 'Kd 7s 2c').points[0]).toMatch(/top pair/);
    expect(hs('Qh Qc', 'Jd 7s 2c').points[0]).toMatch(/overpair/);
    expect(hs('3h 2c', 'Ad Ac Kd Ks Qh').points[0]).toMatch(/shared cards/);
  });

  it('mentions draws and gives an equity estimate after the flop', () => {
    const s = hs('Ah 7h', 'Kh 9h 2c', 2);
    expect(s.category).toBe(HandCategory.HighCard);
    expect(s.points.join(' ')).toMatch(/9 cards would complete it/);
    expect(s.equity).toBeGreaterThan(0.2);
  });

  it('rates the nuts as very strong', () => {
    expect(hs('As Ks', 'Qs Js Ts 2d 3c').level).toBe(4);
  });

  it('adds a note about the seat before the flop', () => {
    expect(handStrength(parseCards('Ts 4s'), [], 2, 'BTN').points.at(-1)).toMatch(/Your seat helps/);
    expect(handStrength(parseCards('Ts 4s'), [], 5, 'UTG').points.at(-1)).toMatch(/stick to Strong/);
  });
});
