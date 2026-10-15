import { describe, expect, it } from 'vitest';
import { createRng, parseCards } from '../engine/cards';
import { GameState, advanceStreet, applyAction, isRoundOver, startHand, viewFor } from '../engine/game';
import { rigged, table } from '../engine/testUtils';
import { BOTS, decide } from '../ai/bot';
import { analyzeDraws, chenScore, estimateEquity, preflopTier } from '../ai/equity';
import { advise, gradeDecision } from './advisor';
import { emptyProgress, mastery, recordDecision, weakSpots } from './progress';
import { explainResult, teachingMoment } from './triggers';

describe('equity and draws', () => {
  it('aces are a big favourite heads-up preflop', () => {
    const eq = estimateEquity(parseCards('As Ah'), [], 1, 3000, createRng(1));
    expect(eq).toBeGreaterThan(0.8);
    expect(eq).toBeLessThan(0.89);
  });

  it('the nuts on the river has 100% equity', () => {
    expect(estimateEquity(parseCards('As Ks'), parseCards('Qs Js Ts 2d 3c'), 3, 200, createRng(1))).toBe(1);
  });

  it('counts flush-draw and open-ended outs', () => {
    const flush = analyzeDraws(parseCards('Ah 7h'), parseCards('Kh 9h 2c'));
    expect(flush.flushDraw).toBe(true);
    expect(flush.outs).toHaveLength(9);
    const oesd = analyzeDraws(parseCards('8c 7d'), parseCards('6h 5s Kc'));
    expect(oesd.openEnded).toBe(true);
    expect(oesd.outs).toHaveLength(8);
    const gut = analyzeDraws(parseCards('9c 8d'), parseCards('6h 5s Kc'));
    expect(gut.gutshot).toBe(true);
    expect(gut.outs).toHaveLength(4);
  });

  it('ignores straights the board makes by itself', () => {
    const d = analyzeDraws(parseCards('2c 2d'), parseCards('6h 7s 8c 9d'));
    expect(d.outs.every((c) => c.rank !== 10 && c.rank !== 5)).toBe(true);
  });

  it('ranks starting hands sensibly', () => {
    expect(chenScore(parseCards('As Ad'))).toBe(20);
    expect(preflopTier(parseCards('As Ad'))).toBe('premium');
    expect(preflopTier(parseCards('7c 2d'))).toBe('weak');
    expect(chenScore(parseCards('Ks Qs'))).toBeGreaterThan(chenScore(parseCards('Kd Qc')));
  });
});

describe('bots', () => {
  it('only ever choose legal actions over many hands', () => {
    const rng = createRng(9);
    let s = table([2000, 2000, 2000, 2000, 2000, 2000], 10, 20);
    for (let h = 0; h < 30; h++) {
      if (s.players.filter((p) => p.stack > 0).length < 2) break;
      s = startHand(s, rng);
      while (s.phase !== 'complete') {
        if (isRoundOver(s)) { s = advanceStreet(s); continue; }
        const seat = s.toAct!;
        const d = decide(viewFor(s, seat), BOTS[seat % BOTS.length], rng);
        s = applyAction(s, d.action); // throws if illegal
        expect(d.reason.length).toBeGreaterThan(5);
      }
    }
  });

  it('decide sees nothing but the bot\'s own view', () => {
    const s = startHand(table([2000, 2000, 2000]), createRng(4));
    const view = viewFor(s, s.toAct!);
    // a view carries no hole cards for opponents, so a decision cannot depend on them
    expect(view.opponents.every((o) => !('hole' in o))).toBe(true);
    expect(() => decide(view, BOTS[0], createRng(1))).not.toThrow();
  });

  it('a strong bot does not fold the nuts', () => {
    let s = rigged(table([2000, 2000]), ['As Ks', '7c 2d'], 'Qs Js Ts 3h 4d');
    // play to the river by checking/calling
    const step = (st: GameState) => { while (isRoundOver(st)) st = advanceStreet(st); return st; };
    s = step(applyAction(s, { type: 'call' }));
    s = step(applyAction(s, { type: 'check' }));
    while (s.phase !== 'river') {
      s = step(applyAction(s, { type: 'check' }));
    }
    // seat 1 (BB) acts first postflop heads-up; let it bet, then ask the bot in seat 0
    s = applyAction(s, { type: 'bet', amount: 200 });
    const d = decide(viewFor(s, 0), BOTS[1], createRng(2));
    expect(d.action.type).not.toBe('fold');
  });
});

describe('coach advice', () => {
  it('suggests folding 7-2 offsuit under the gun', () => {
    let s = rigged(table([2000, 2000, 2000, 2000, 2000, 2000], 10, 20), ['', '', '', '7c 2d', '', ''], '2s 3s 4s 5d 6d');
    // seat 3 is UTG (button 0, SB 1, BB 2)
    s = { ...s, players: s.players.map((p) => (p.seat === 3 ? p : { ...p, hole: parseCards(['Ah Ad', 'Kh Kd', 'Qh Qd', '', 'Jh Jd', 'Th Td'][p.seat]) })) };
    const a = advise(viewFor(s, 3));
    expect(a.best).toBe('fold');
    expect(a.concepts).toContain('starting-hands');
    expect(gradeDecision(a, 'call').grade).toBe('costly');
    expect(gradeDecision(a, 'fold').grade).toBe('solid');
  });

  it('suggests raising aces preflop', () => {
    const s = rigged(table([2000, 2000, 2000], 10, 20), ['As Ad', 'Kh 2c', '9d 4c'], '2s 3s 7h 8d Td');
    const a = advise(viewFor(s, 0));
    expect(a.best).toBe('raise');
    expect(a.amount).toBeGreaterThanOrEqual(40);
  });

  it('uses pot odds when facing a bet with a draw', () => {
    let s = rigged(table([2000, 2000], 10, 20), ['Ah 7h', 'Kc Kd'], 'Kh 9h 2c 3s 4d');
    const step = (st: GameState) => { while (isRoundOver(st)) st = advanceStreet(st); return st; };
    s = step(applyAction(s, { type: 'call' }));
    s = step(applyAction(s, { type: 'check' }));
    expect(s.phase).toBe('flop');
    s = applyAction(s, { type: 'bet', amount: 20 }); // BB bets small: half pot
    const a = advise(viewFor(s, 0));
    expect(a.concepts).toContain('pot-odds');
    expect(a.concepts).toContain('outs');
    expect(a.numbers.potOdds).toBeCloseTo(20 / 80);
    expect(a.best).not.toBe('fold');
    expect(a.hint).toMatch(/9 outs/);
  });

  it('grades on the information available, not the result', () => {
    const a = { best: 'fold', fine: [], close: false, showMe: 'Fold. Too expensive.' } as never;
    expect(gradeDecision(a, 'call').grade).toBe('costly');
  });
});

describe('progress and adaptive teaching', () => {
  it('mastery rises with good decisions and weak spots are found', () => {
    let p = emptyProgress();
    for (let i = 0; i < 10; i++) p = recordDecision(p, ['starting-hands'], 'solid', 0);
    for (let i = 0; i < 4; i++) p = recordDecision(p, ['pot-odds'], 'costly', 0);
    expect(mastery(p.concepts['starting-hands'])).toBe('mastered');
    expect(weakSpots(p)).toEqual(['pot-odds']);
  });

  it('shows intro tips once, then stays quiet on mastered concepts', () => {
    const s = startHand(table([2000, 2000, 2000], 10, 20), createRng(5));
    const view = viewFor(s, s.toAct!);
    const advice = advise(view);
    let p = emptyProgress();
    const ctx = { view, advice, progress: p, coach: 'full' as const, focus: [], prevCategory: null, shownThisHand: [] };
    const first = teachingMoment(ctx)!;
    expect(first.id).toBe('intro-blinds');
    p = { ...p, seenTips: [first.id] };
    const second = teachingMoment({ ...ctx, progress: p })!;
    expect(second.id).not.toBe('intro-blinds');
    expect(teachingMoment({ ...ctx, coach: 'off' })).toBeNull();
  });

  it('explains a showdown with kickers', () => {
    let s = rigged(table([100, 100]), ['Ah Kd', 'Ac Qd'], 'As 8s 4c 3h 2d');
    s = applyAction(s, { type: 'raise', amount: 100 });
    s = applyAction(s, { type: 'call' });
    while (isRoundOver(s)) s = advanceStreet(s);
    const lines = explainResult(s, 0, []);
    expect(lines[0]).toMatch(/You won with pair of aces/);
    expect(lines[0]).toMatch(/kicker/);
  });
});
