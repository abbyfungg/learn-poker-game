import { describe, expect, it } from 'vitest';
import { createRng } from './cards';
import {
  Action, GameState, IllegalActionError, advanceStreet, applyAction, buildPots, chipTotal, isRoundOver,
  legalActions, positionOf, startHand, viewFor,
} from './game';
import { rigged, table } from './testUtils';

/** Apply actions in order, dealing streets whenever a betting round closes. */
function play(s: GameState, ...actions: Action[]): GameState {
  for (const a of actions) {
    s = applyAction(s, a);
    while (isRoundOver(s)) s = advanceStreet(s);
  }
  return s;
}
const fold: Action = { type: 'fold' };
const check: Action = { type: 'check' };
const call: Action = { type: 'call' };
const raise = (amount: number): Action => ({ type: 'raise', amount });
const bet = (amount: number): Action => ({ type: 'bet', amount });

describe('blinds, positions and turn order', () => {
  it('3-handed: button, blinds, and UTG acts first', () => {
    const s = startHand(table([1000, 1000, 1000]), createRng(1));
    expect([s.button, s.sbSeat, s.bbSeat]).toEqual([0, 1, 2]);
    expect(s.players[1].bet).toBe(5);
    expect(s.players[2].bet).toBe(10);
    expect(s.toAct).toBe(0);
    expect(s.players.every((p) => p.hole.length === 2)).toBe(true);
    expect(positionOf(s, 0)).toBe('BTN');
  });

  it('deals 52 unique cards', () => {
    const s = startHand(table([1000, 1000, 1000, 1000, 1000, 1000]), createRng(7));
    const all = [...s.deck, ...s.players.flatMap((p) => p.hole)].map((c) => `${c.rank}${c.suit}`);
    expect(new Set(all).size).toBe(52);
  });

  it('heads-up: button posts the small blind and acts first preflop, last postflop', () => {
    let s = startHand(table([1000, 1000]), createRng(1));
    expect(s.sbSeat).toBe(s.button);
    expect(s.toAct).toBe(s.button);
    s = play(s, call, check);
    expect(s.phase).toBe('flop');
    expect(s.toAct).toBe(s.bbSeat);
  });

  it('button moves and skips busted seats', () => {
    let s = startHand(table([1000, 0, 1000, 1000]), createRng(1));
    expect(s.players[1].out).toBe(true);
    expect([s.button, s.sbSeat, s.bbSeat]).toEqual([0, 2, 3]);
    s = play(s, fold, fold); // UTG(0) folds, SB folds → BB wins
    s = startHand(s, createRng(2));
    expect(s.button).toBe(2);
  });

  it('a short stack posting the big blind is all-in', () => {
    const s = startHand(table([1000, 1000, 6]), createRng(1));
    expect(s.players[2].allIn).toBe(true);
    expect(s.players[2].bet).toBe(6);
    expect(s.currentBet).toBe(10);
  });
});

describe('legal actions', () => {
  it('rejects illegal actions', () => {
    const s = startHand(table([1000, 1000, 1000]), createRng(1));
    expect(() => applyAction(s, check)).toThrow(IllegalActionError);
    expect(() => applyAction(s, bet(50))).toThrow(IllegalActionError);
    expect(() => applyAction(s, raise(15))).toThrow(/Minimum is 20/);
    expect(() => applyAction(s, raise(5000))).toThrow(IllegalActionError);
  });

  it('big blind gets the option when everyone limps', () => {
    let s = startHand(table([1000, 1000, 1000]), createRng(1));
    s = play(s, call, call);
    expect(s.phase).toBe('preflop');
    expect(s.toAct).toBe(2);
    const legal = legalActions(s)!;
    expect(legal.canCheck).toBe(true);
    expect(legal.canFold).toBe(false);
    expect(legal.canRaise).toBe(true);
    s = play(s, check);
    expect(s.phase).toBe('flop');
    expect(s.pot).toBe(30);
  });

  it('minimum re-raise equals the last raise size', () => {
    let s = startHand(table([1000, 1000, 1000]), createRng(1));
    s = applyAction(s, raise(40)); // raise of 30
    expect(legalActions(s)!.minTo).toBe(70);
    expect(() => applyAction(s, raise(60))).toThrow();
    s = applyAction(s, raise(70));
    expect(legalActions(s)!.minTo).toBe(100);
  });

  it('an incomplete all-in raise does not reopen raising for players who already acted', () => {
    let s = startHand(table([1000, 1000, 45]), createRng(1));
    s = applyAction(s, raise(30)); // BTN raises to 30 (full raise of 20)
    s = applyAction(s, call); // SB calls
    s = applyAction(s, raise(45)); // BB all-in for 45: only +15
    expect(s.players[2].allIn).toBe(true);
    const legal = legalActions(s)!;
    expect(legal.seat).toBe(0);
    expect(legal.callAmount).toBe(15);
    expect(legal.canRaise).toBe(false);
    s = applyAction(s, call);
    expect(legalActions(s)!.canRaise).toBe(false);
  });

  it('a first bet reopens raising and sets the minimum raise to at least the big blind', () => {
    let s = startHand(table([1000, 1000, 1000]), createRng(1));
    s = play(s, call, call, check);
    expect(s.phase).toBe('flop');
    s = applyAction(s, bet(10));
    expect(legalActions(s)!.minTo).toBe(20);
  });
});

describe('pots, all-ins and showdown', () => {
  it('folding around gives the big blind the pot', () => {
    let s = startHand(table([1000, 1000, 1000]), createRng(1));
    const before = chipTotal(s);
    s = play(s, fold, fold);
    expect(s.phase).toBe('complete');
    expect(s.result!.uncontested).toBe(true);
    expect(s.players[2].stack).toBe(1005);
    expect(chipTotal(s)).toBe(before);
  });

  it('builds main and side pots and pays each correctly', () => {
    // seat0 best hand, seat1 second best, seat2 worst
    let s = rigged(table([100, 200, 300]), ['Ah Ad', 'Kh Kd', '7c 2d'], '9s 8s 4c 3h Jd');
    s = play(s, raise(100), raise(200), call);
    expect(s.phase).toBe('complete');
    expect(s.result!.pots.map((p) => p.amount)).toEqual([300, 200]);
    expect(s.result!.pots[0].winners).toEqual([0]);
    expect(s.result!.pots[1].winners).toEqual([1]);
    expect(s.players.map((p) => p.stack)).toEqual([300, 200, 100]);
  });

  it('short all-in winner only wins the main pot', () => {
    let s = rigged(table([100, 200, 300]), ['Ah Ad', 'Kh Kd', 'Qc Qd'], '9s 8s 4c 3h Jd');
    s = play(s, raise(100), raise(200), call);
    expect(s.players[0].stack).toBe(300);
    expect(s.players[1].stack).toBe(200);
  });

  it('returns uncalled chips', () => {
    let s = rigged(table([500, 200]), ['Ah Ad', 'Kh Kd'], '9s 8s 4c 3h Jd');
    s = play(s, raise(500), call);
    expect(s.result!.returned).toEqual({ seat: 0, amount: 300 });
    expect(s.players[0].stack).toBe(700);
    expect(s.players[1].stack).toBe(0);
  });

  it('splits a pot and gives the odd chip to the first winner left of the button', () => {
    let s = rigged(table([1000, 1000, 1000]), ['2c 3d', '4h 5h', '2d 3c'], 'As Ks Qs Js Ts');
    s = play(s, call, fold, check, check, check, check, check, check, check);
    expect(s.phase).toBe('complete');
    expect(s.result!.pots[0].amount).toBe(25);
    expect(s.result!.pots[0].winners.sort()).toEqual([0, 2]);
    expect(s.result!.payouts).toEqual({ 0: 12, 2: 13 });
  });

  it('folded chips stay in the pot but folded players are never eligible', () => {
    const pots = buildPots([
      { seat: 0, committed: 100, folded: true, out: false },
      { seat: 1, committed: 50, folded: false, out: false },
      { seat: 2, committed: 100, folded: false, out: false },
    ] as never);
    expect(pots).toEqual([
      { amount: 150, eligible: [1, 2] },
      { amount: 100, eligible: [2] },
    ]);
  });

  it('runs the board out when everyone is all-in', () => {
    let s = rigged(table([100, 100]), ['Ah Ad', 'Kh Kd'], '9s 8s 4c 3h Jd');
    s = play(s, raise(100), call);
    expect(s.board).toHaveLength(5);
    expect(s.phase).toBe('complete');
    expect(s.players[0].stack).toBe(200);
  });
});

describe('hidden information', () => {
  it('a player view never contains other players\' hole cards', () => {
    const s = startHand(table([1000, 1000, 1000]), createRng(3));
    const view = viewFor(s, 1);
    expect(view.hole).toEqual(s.players[1].hole);
    for (const o of view.opponents) expect(o).not.toHaveProperty('hole');
    const json = JSON.stringify(view);
    for (const seat of [0, 2]) {
      for (const c of s.players[seat].hole) {
        const isMine = s.players[1].hole.some((m) => m.rank === c.rank && m.suit === c.suit);
        if (!isMine) expect(json).not.toContain(`{"rank":${c.rank},"suit":"${c.suit}"}`);
      }
    }
  });
});

describe('invariants under random play', () => {
  it('conserves chips and always terminates across 400 random hands', () => {
    const rng = createRng(42);
    for (let t = 0; t < 40; t++) {
      const n = 2 + Math.floor(rng() * 5);
      let s = table(Array.from({ length: n }, () => 20 + Math.floor(rng() * 500)));
      const total = chipTotal(s);
      for (let h = 0; h < 10; h++) {
        if (s.players.filter((p) => p.stack > 0).length < 2) break;
        s = startHand(s, rng);
        let steps = 0;
        while (s.phase !== 'complete') {
          if (++steps > 500) throw new Error('hand did not terminate');
          if (isRoundOver(s)) { s = advanceStreet(s); continue; }
          const l = legalActions(s)!;
          const opts: Action[] = [];
          if (l.canFold) opts.push(fold);
          if (l.canCheck) opts.push(check);
          if (l.callAmount > 0) opts.push(call);
          if (l.canBet) opts.push(bet(l.minTo + Math.floor(rng() * (l.maxTo - l.minTo + 1))));
          if (l.canRaise) opts.push(raise(l.minTo + Math.floor(rng() * (l.maxTo - l.minTo + 1))));
          s = applyAction(s, opts[Math.floor(rng() * opts.length)]);
          expect(chipTotal(s)).toBe(total);
          expect(s.players.every((p) => p.stack >= 0)).toBe(true);
        }
        expect(chipTotal(s)).toBe(total);
      }
    }
  });
});
