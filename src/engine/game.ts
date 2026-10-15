import { Card, Rng, fullDeck, shuffle } from './cards';
import { HandValue, evaluateBest } from './evaluator';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type Phase = Street | 'showdown' | 'complete';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface Action {
  type: ActionType;
  /** For bet/raise: the total this player's bet becomes this street ("raise to"). */
  amount?: number;
}

export interface Player {
  seat: number;
  id: string;
  name: string;
  isHero: boolean;
  stack: number;
  hole: Card[];
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in this hand (all streets). */
  committed: number;
  folded: boolean;
  allIn: boolean;
  /** Not dealt into this hand (no chips). */
  out: boolean;
  /** Has acted since the last full bet/raise this street. */
  hasActed: boolean;
  /** Acted already and only faced an incomplete all-in raise since: may call/fold but not re-raise. */
  raiseLocked: boolean;
}

export interface ActionRecord {
  street: Street;
  seat: number;
  kind: ActionType | 'post-sb' | 'post-bb';
  /** Chips moved into the pot by this action. */
  added: number;
  /** Player's street bet after the action. */
  betTo: number;
  allIn: boolean;
  potBefore: number;
}

export interface PotResult {
  amount: number;
  eligible: number[];
  winners: number[];
  /** Hand used to win (absent when won uncontested). */
  hand?: HandValue;
}

export interface HandResult {
  pots: PotResult[];
  /** Hand values for every player who reached showdown. */
  shown: Record<number, HandValue>;
  /** Net chips won per seat (payout). */
  payouts: Record<number, number>;
  uncontested: boolean;
  /** Uncalled chips returned, if any. */
  returned?: { seat: number; amount: number };
}

export interface GameState {
  handNumber: number;
  players: Player[];
  button: number;
  sbSeat: number;
  bbSeat: number;
  smallBlind: number;
  bigBlind: number;
  deck: Card[];
  board: Card[];
  phase: Phase;
  /** Seat to act, or null when the betting round is closed. */
  toAct: number | null;
  currentBet: number;
  /** Size of the last full bet or raise this street (minimum raise increment). */
  minRaise: number;
  /** Chips from completed streets. Current street bets are in player.bet. */
  pot: number;
  log: ActionRecord[];
  result: HandResult | null;
  /** Uncalled chips handed back this hand (shown in the result). */
  returned?: { seat: number; amount: number };
}

export interface SeatConfig {
  id: string;
  name: string;
  stack: number;
  isHero?: boolean;
}

export function totalPot(s: GameState): number {
  return s.pot + s.players.reduce((n, p) => n + p.bet, 0);
}

function clone(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, hole: p.hole.slice() })),
    deck: s.deck.slice(),
    board: s.board.slice(),
    log: s.log.slice(),
  };
}

/** Next seat clockwise (index order) after `from` that satisfies `pred`. */
export function nextSeat(players: Player[], from: number, pred: (p: Player) => boolean): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const p = players[(from + i) % n];
    if (pred(p)) return p.seat;
  }
  return -1;
}

const inHand = (p: Player) => !p.out && !p.folded;
const canAct = (p: Player) => inHand(p) && !p.allIn;

export function createTable(seats: SeatConfig[], smallBlind: number, bigBlind: number): GameState {
  return {
    handNumber: 0,
    players: seats.map((c, seat) => ({
      seat, id: c.id, name: c.name, isHero: !!c.isHero, stack: c.stack, hole: [], bet: 0, committed: 0,
      folded: false, allIn: false, out: c.stack <= 0, hasActed: false, raiseLocked: false,
    })),
    button: -1, sbSeat: -1, bbSeat: -1, smallBlind, bigBlind,
    deck: [], board: [], phase: 'complete', toAct: null, currentBet: 0, minRaise: bigBlind, pot: 0, log: [], result: null,
  };
}

function postBlind(s: GameState, seat: number, amount: number, kind: 'post-sb' | 'post-bb') {
  const p = s.players[seat];
  const paid = Math.min(amount, p.stack);
  const potBefore = totalPot(s);
  p.stack -= paid;
  p.bet += paid;
  p.committed += paid;
  if (p.stack === 0) p.allIn = true;
  s.log.push({ street: 'preflop', seat, kind, added: paid, betTo: p.bet, allIn: p.allIn, potBefore });
}

/** Start a new hand: move the button, post blinds, shuffle and deal. */
export function startHand(prev: GameState, rng: Rng): GameState {
  const s = clone(prev);
  for (const p of s.players) {
    Object.assign(p, { hole: [], bet: 0, committed: 0, folded: false, allIn: false, hasActed: false, raiseLocked: false, out: p.stack <= 0 });
  }
  const active = s.players.filter((p) => !p.out);
  if (active.length < 2) throw new Error('Need at least two players with chips');

  s.handNumber += 1;
  s.button = nextSeat(s.players, s.button < 0 ? s.players.length - 1 : s.button, (p) => !p.out);
  const headsUp = active.length === 2;
  s.sbSeat = headsUp ? s.button : nextSeat(s.players, s.button, (p) => !p.out);
  s.bbSeat = nextSeat(s.players, s.sbSeat, (p) => !p.out);
  s.board = [];
  s.pot = 0;
  s.log = [];
  s.result = null;
  s.returned = undefined;
  s.phase = 'preflop';
  s.deck = shuffle(fullDeck(), rng);

  postBlind(s, s.sbSeat, s.smallBlind, 'post-sb');
  postBlind(s, s.bbSeat, s.bigBlind, 'post-bb');
  s.currentBet = s.bigBlind;
  s.minRaise = s.bigBlind;

  // deal one card at a time, starting left of the button
  for (let round = 0; round < 2; round++) {
    let seat = s.button;
    for (let i = 0; i < active.length; i++) {
      seat = nextSeat(s.players, seat, (p) => !p.out);
      s.players[seat].hole.push(s.deck.pop()!);
    }
  }

  s.toAct = nextSeat(s.players, s.bbSeat, canAct);
  if (s.toAct === -1 || !needsAction(s)) s.toAct = null;
  return s;
}

/** Can anyone still act this street? */
function needsAction(s: GameState): boolean {
  const live = s.players.filter(inHand);
  if (live.length <= 1) return false;
  const actors = live.filter((p) => !p.allIn);
  if (actors.length === 0) return false;
  // nobody left to bet against: only act if facing a bet
  if (actors.length === 1) return actors[0].bet < s.currentBet;
  // a lone non-all-in player only needs to act if facing a bet
  return actors.some((p) => !p.hasActed || p.bet < s.currentBet);
}

export interface LegalActions {
  seat: number;
  canFold: boolean;
  canCheck: boolean;
  /** Chips needed to call (capped by stack); 0 if cannot call. */
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  /** Minimum and maximum "to" amounts for bet/raise. */
  minTo: number;
  maxTo: number;
  toCall: number;
}

export function legalActions(s: GameState): LegalActions | null {
  if (s.toAct === null) return null;
  const p = s.players[s.toAct];
  const toCall = s.currentBet - p.bet;
  const maxTo = p.bet + p.stack;
  const callAmount = toCall > 0 ? Math.min(toCall, p.stack) : 0;
  const canBet = s.currentBet === 0 && p.stack > 0;
  const canRaise = s.currentBet > 0 && maxTo > s.currentBet && !p.raiseLocked;
  const fullMin = s.currentBet === 0 ? s.bigBlind : s.currentBet + s.minRaise;
  return {
    seat: p.seat,
    canFold: toCall > 0,
    canCheck: toCall <= 0,
    callAmount,
    canBet,
    canRaise,
    minTo: Math.min(fullMin, maxTo),
    maxTo,
    toCall: Math.max(0, toCall),
  };
}

export class IllegalActionError extends Error {}

/** Apply an action for the seat to act. Returns a new state; throws IllegalActionError on illegal input. */
export function applyAction(prev: GameState, action: Action): GameState {
  const legal = legalActions(prev);
  if (!legal) throw new IllegalActionError('No player to act');
  const s = clone(prev);
  const p = s.players[legal.seat];
  const potBefore = totalPot(s);
  const street = s.phase as Street;
  let kind: ActionType = action.type;
  let added = 0;

  switch (action.type) {
    case 'fold':
      if (!legal.canFold) throw new IllegalActionError('Cannot fold when you can check');
      p.folded = true;
      break;
    case 'check':
      if (!legal.canCheck) throw new IllegalActionError('Cannot check facing a bet');
      break;
    case 'call':
      if (legal.callAmount <= 0) throw new IllegalActionError('Nothing to call');
      added = legal.callAmount;
      break;
    case 'bet':
    case 'raise': {
      const isBet = action.type === 'bet';
      if (isBet ? !legal.canBet : !legal.canRaise) throw new IllegalActionError(`Cannot ${action.type} now`);
      const to = Math.floor(action.amount ?? 0);
      if (to > legal.maxTo) throw new IllegalActionError(`Not enough chips to make it ${to}`);
      if (to < legal.minTo) throw new IllegalActionError(`Minimum is ${legal.minTo}`);
      added = to - p.bet;
      const raiseSize = to - s.currentBet;
      // a first bet always reopens action; a raise only does if it is a full raise
      const full = isBet || raiseSize >= s.minRaise;
      for (const o of s.players) {
        if (o.seat === p.seat || !canAct(o)) continue;
        if (full) { o.hasActed = false; o.raiseLocked = false; }
        else { o.raiseLocked = o.hasActed; o.hasActed = false; }
      }
      if (full) s.minRaise = Math.max(raiseSize, s.bigBlind);
      s.currentBet = to;
      break;
    }
  }

  p.stack -= added;
  p.bet += added;
  p.committed += added;
  if (p.stack === 0 && !p.folded) p.allIn = true;
  p.hasActed = true;
  p.raiseLocked = false;
  s.log.push({ street, seat: p.seat, kind, added, betTo: p.bet, allIn: p.allIn, potBefore });

  if (s.players.filter(inHand).length === 1) {
    s.toAct = null;
    return finishUncontested(s);
  }
  s.toAct = needsAction(s) ? nextSeat(s.players, p.seat, (o) => canAct(o) && (!o.hasActed || o.bet < s.currentBet)) : null;
  return s;
}

/** Return the part of the largest bet nobody matched. */
function returnUncalled(s: GameState): HandResult['returned'] {
  const live = s.players.filter((p) => !p.out);
  const top = live.reduce((a, b) => (b.committed > a.committed ? b : a));
  const second = Math.max(0, ...live.filter((p) => p !== top).map((p) => p.committed));
  const excess = top.committed - second;
  if (excess > 0) {
    top.committed -= excess;
    top.bet = Math.max(0, top.bet - excess);
    top.stack += excess;
    if (top.stack > 0) top.allIn = false;
    return { seat: top.seat, amount: excess };
  }
  return undefined;
}

function collectBets(s: GameState) {
  for (const p of s.players) { s.pot += p.bet; p.bet = 0; }
}

function finishUncontested(s: GameState): GameState {
  const returned = returnUncalled(s);
  collectBets(s);
  const winner = s.players.find(inHand)!;
  const amount = s.pot;
  winner.stack += amount;
  s.result = {
    pots: [{ amount, eligible: [winner.seat], winners: [winner.seat] }],
    shown: {}, payouts: { [winner.seat]: amount }, uncontested: true, returned,
  };
  s.pot = 0;
  s.phase = 'complete';
  return s;
}

/** True when the betting round is over and the UI should call advanceStreet(). */
export function isRoundOver(s: GameState): boolean {
  return s.toAct === null && s.phase !== 'complete' && s.phase !== 'showdown';
}

/**
 * Explicit transition after a betting round closes: collect bets and deal the next street,
 * or go to showdown. When nobody can act any more the UI keeps calling this to run the board out.
 */
export function advanceStreet(prev: GameState): GameState {
  if (!isRoundOver(prev)) throw new IllegalActionError('Betting round is not over');
  const s = clone(prev);
  const returned = returnUncalled(s);
  collectBets(s);
  if (returned) s.returned = returned;
  for (const p of s.players) { p.hasActed = false; p.raiseLocked = false; }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;

  const next: Record<string, Phase> = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown' };
  s.phase = next[s.phase];
  if (s.phase === 'showdown') return showdown(s);

  s.deck.pop(); // burn
  const count = s.phase === 'flop' ? 3 : 1;
  for (let i = 0; i < count; i++) s.board.push(s.deck.pop()!);

  s.toAct = needsAction(s) ? nextSeat(s.players, s.button, canAct) : null;
  return s;
}

/** Build main and side pots from total contributions. */
export function buildPots(players: Player[]): { amount: number; eligible: number[] }[] {
  const contributors = players.filter((p) => p.committed > 0);
  const levels = [...new Set(players.filter(inHand).map((p) => p.committed))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: number[] }[] = [];
  let prevLevel = 0;
  for (const level of levels) {
    let amount = 0;
    for (const p of contributors) amount += Math.max(0, Math.min(p.committed, level) - prevLevel);
    const eligible = players.filter((p) => inHand(p) && p.committed >= level).map((p) => p.seat);
    if (amount > 0) pots.push({ amount, eligible });
    prevLevel = level;
  }
  // chips from folded players above every live player's level (can't happen after returnUncalled, but be safe)
  const leftover = contributors.reduce((n, p) => n + Math.max(0, p.committed - prevLevel), 0);
  if (leftover > 0 && pots.length) pots[pots.length - 1].amount += leftover;
  return pots;
}

function showdown(s: GameState): GameState {
  const live = s.players.filter(inHand);
  const shown: Record<number, HandValue> = {};
  for (const p of live) shown[p.seat] = evaluateBest([...p.hole, ...s.board]);

  const pots = buildPots(s.players);
  const payouts: Record<number, number> = {};
  const results: PotResult[] = [];
  for (const pot of pots) {
    const best = Math.max(...pot.eligible.map((seat) => shown[seat].score));
    const winners = pot.eligible.filter((seat) => shown[seat].score === best);
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    // odd chips go to winners in seat order starting left of the button
    const ordered: number[] = [];
    let seat = s.button;
    for (let i = 0; i < s.players.length; i++) {
      seat = (seat + 1) % s.players.length;
      if (winners.includes(seat)) ordered.push(seat);
    }
    for (const w of ordered) {
      const amt = share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
      payouts[w] = (payouts[w] ?? 0) + amt;
    }
    results.push({ amount: pot.amount, eligible: pot.eligible, winners, hand: shown[winners[0]] });
  }
  for (const [seat, amt] of Object.entries(payouts)) s.players[Number(seat)].stack += amt;

  s.result = { pots: results, shown, payouts, uncontested: false, returned: s.returned };
  s.pot = 0;
  s.toAct = null;
  s.phase = 'complete';
  return s;
}

/** Chips each seat must have in front of them to sum to the starting total (for invariant tests). */
export function chipTotal(s: GameState): number {
  return s.players.reduce((n, p) => n + p.stack + p.bet, 0) + s.pot;
}

// ---------- Positions ----------

export type PositionName = 'BTN' | 'SB' | 'BB' | 'UTG' | 'MP' | 'HJ' | 'CO';

export const POSITION_LABELS: Record<PositionName, string> = {
  BTN: 'Button', SB: 'Small blind', BB: 'Big blind', UTG: 'Under the gun', MP: 'Middle', HJ: 'Hijack', CO: 'Cutoff',
};

/** Position name for a seat in the current hand. */
export function positionOf(s: GameState, seat: number): PositionName | null {
  const p = s.players[seat];
  if (p.out) return null;
  if (seat === s.button) return 'BTN';
  if (seat === s.sbSeat) return 'SB';
  if (seat === s.bbSeat) return 'BB';
  // seats after BB in acting order
  const order: number[] = [];
  let cur = s.bbSeat;
  for (;;) {
    cur = nextSeat(s.players, cur, (o) => !o.out);
    if (cur === s.button) break;
    order.push(cur);
  }
  const idx = order.indexOf(seat);
  const fromEnd = order.length - 1 - idx;
  if (fromEnd === 0) return 'CO';
  if (fromEnd === 1) return 'HJ';
  if (idx === 0) return 'UTG';
  return 'MP';
}

/** Broad position bucket used for teaching. */
export function positionGroup(pos: PositionName | null): 'early' | 'middle' | 'late' | 'blinds' {
  if (pos === 'SB' || pos === 'BB') return 'blinds';
  if (pos === 'BTN' || pos === 'CO') return 'late';
  if (pos === 'HJ' || pos === 'MP') return 'middle';
  return 'early';
}

// ---------- Views (hidden information) ----------

export interface PlayerView {
  seat: number;
  hole: Card[];
  board: Card[];
  phase: Phase;
  pot: number;
  toCall: number;
  currentBet: number;
  bigBlind: number;
  stack: number;
  myBet: number;
  /** Opponents still in the hand (no hole cards). */
  opponents: { seat: number; stack: number; bet: number; allIn: boolean; committed: number }[];
  position: PositionName | null;
  legal: LegalActions | null;
  log: ActionRecord[];
  button: number;
  playersDealt: number;
}

/** What `seat` is allowed to know. Decision-making code must use this, never GameState. */
export function viewFor(s: GameState, seat: number): PlayerView {
  const me = s.players[seat];
  const legal = s.toAct === seat ? legalActions(s) : null;
  return {
    seat,
    hole: me.hole.slice(),
    board: s.board.slice(),
    phase: s.phase,
    pot: totalPot(s),
    toCall: Math.max(0, s.currentBet - me.bet),
    currentBet: s.currentBet,
    bigBlind: s.bigBlind,
    stack: me.stack,
    myBet: me.bet,
    opponents: s.players
      .filter((p) => p.seat !== seat && inHand(p))
      .map((p) => ({ seat: p.seat, stack: p.stack, bet: p.bet, allIn: p.allIn, committed: p.committed })),
    position: positionOf(s, seat),
    legal,
    log: s.log.slice(),
    button: s.button,
    playersDealt: s.players.filter((p) => !p.out).length,
  };
}
