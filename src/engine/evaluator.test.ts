import { describe, expect, it } from 'vitest';
import { parseCards } from './cards';
import { HandCategory, evaluateBest, explainComparison } from './evaluator';

const ev = (s: string) => evaluateBest(parseCards(s));

describe('hand evaluation', () => {
  it.each([
    ['As Ks Qs Js Ts 2d 3c', HandCategory.StraightFlush, 'Royal flush'],
    ['9h 9d 9s 9c Kd 2c 3h', HandCategory.Quads, 'Four Nines'],
    ['Th Td Ts 4c 4d Ah 2c', HandCategory.FullHouse, 'Full house, Tens full of Fours'],
    ['Ah 9h 6h 3h 2h Kd Kc', HandCategory.Flush, 'Flush, Ace-high'],
    ['5d 6c 7h 8s 9d Ah Ac', HandCategory.Straight, 'Straight, Nine-high'],
    ['Ah 2d 3c 4s 5h Kd Qc', HandCategory.Straight, 'Straight, Five-high'],
    ['7h 7d 7c As Kd 2c 3h', HandCategory.Trips, 'Three Sevens'],
    ['Kh Kd 7c 7s 2d 3c 9h', HandCategory.TwoPair, 'Two pair, Kings and Sevens'],
    ['6h 6d Ac Ks 2d 3c 9h', HandCategory.Pair, 'Pair of Sixes'],
    ['Ah Jd 9c 7s 4d 3c 2h', HandCategory.HighCard, 'Ace-high'],
  ])('%s → %s', (cards, category, name) => {
    const v = ev(cards);
    expect(v.category).toBe(category);
    expect(v.name).toBe(name);
    expect(v.cards).toHaveLength(5);
  });

  it('ranks categories in the right order', () => {
    const order = [
      'Ah Jd 9c 7s 4d', '6h 6d Ac Ks 2d', 'Kh Kd 7c 7s 2d', '7h 7d 7c As Kd', '5d 6c 7h 8s 9d',
      'Ah 9h 6h 3h 2h', 'Th Td Ts 4c 4d', '9h 9d 9s 9c Kd', '5s 6s 7s 8s 9s',
    ].map(ev);
    for (let i = 1; i < order.length; i++) expect(order[i].score).toBeGreaterThan(order[i - 1].score);
  });

  it('wheel loses to a six-high straight', () => {
    expect(ev('6c 2d 3c 4s 5h').score).toBeGreaterThan(ev('Ah 2d 3c 4s 5h').score);
  });

  it('uses kickers to break pairs', () => {
    const a = ev('Ah Ad Kc 7s 4d 3c 2h');
    const b = ev('As Ac Qc 7d 4h 3s 2d');
    expect(a.score).toBeGreaterThan(b.score);
    expect(explainComparison(a, b)).toMatch(/kicker/);
  });

  it('two pair compares second pair then kicker', () => {
    expect(ev('Kh Kd 9c 9s 2d').score).toBeGreaterThan(ev('Ks Kc 8c 8s Ad').score);
    expect(ev('Kh Kd 9c 9s 3d').score).toBeGreaterThan(ev('Ks Kc 9h 9d 2d').score);
  });

  it('board plays: identical five-card hands tie regardless of suit', () => {
    const board = 'As Ks Qd Jc Th';
    expect(ev(`2c 3d ${board}`).score).toBe(ev(`4h 5h ${board}`).score);
  });

  it('picks the best five from seven (flush over straight)', () => {
    const v = ev('8h 9h Th Jc Qh 2h 3s');
    expect(v.category).toBe(HandCategory.Flush);
  });

  it('two trips make a full house with the higher set', () => {
    const v = ev('8h 8d 8c 5s 5h 5d 2c');
    expect(v.name).toBe('Full house, Eights full of Fives');
  });

  it('flush compares all five cards', () => {
    expect(ev('Ah Qh 9h 6h 3h').score).toBeGreaterThan(ev('Ad Qd 9d 6d 2d').score);
  });
});
