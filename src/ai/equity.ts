import { Card, Rank, Rng, remainingDeck, sameCard } from '../engine/cards';
import { HandCategory, evaluateBest, scoreBest } from '../engine/evaluator';

/**
 * Monte Carlo equity of `hole` against `opponents` random hands.
 * Only uses the caller's own cards and the board — never anyone else's hole cards.
 * Returns the share of the pot won on average (ties count fractionally).
 */
export function estimateEquity(hole: Card[], board: Card[], opponents: number, iterations: number, rng: Rng): number {
  if (opponents <= 0) return 1;
  const deck = remainingDeck([...hole, ...board]);
  const need = 5 - board.length;
  let won = 0;
  for (let i = 0; i < iterations; i++) {
    // partial Fisher–Yates: draw only the cards we need
    const draw = need + opponents * 2;
    for (let k = 0; k < draw; k++) {
      const j = k + Math.floor(rng() * (deck.length - k));
      [deck[k], deck[j]] = [deck[j], deck[k]];
    }
    const fullBoard = board.concat(deck.slice(0, need));
    const mine = scoreBest(hole.concat(fullBoard));
    let best = mine;
    let tiedWith = 1;
    let lost = false;
    for (let o = 0; o < opponents; o++) {
      const base = need + o * 2;
      const theirs = scoreBest([deck[base], deck[base + 1], ...fullBoard]);
      if (theirs > best) { lost = true; break; }
      if (theirs === best) tiedWith++;
    }
    if (!lost) won += 1 / tiedWith;
  }
  return won / iterations;
}

/** Chen formula: a quick, well-known preflop hand score (roughly -1..20). */
export function chenScore(hole: Card[]): number {
  const [a, b] = hole.slice().sort((x, y) => y.rank - x.rank);
  const base = (r: Rank) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let score = base(a.rank);
  if (a.rank === b.rank) return Math.max(5, score * 2);
  if (a.suit === b.suit) score += 2;
  const gap = a.rank - b.rank - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && a.rank < 12) score += 1;
  return Math.ceil(score);
}

export type PreflopTier = 'premium' | 'strong' | 'playable' | 'speculative' | 'weak';

export function preflopTier(hole: Card[]): PreflopTier {
  const c = chenScore(hole);
  if (c >= 12) return 'premium';
  if (c >= 9) return 'strong';
  if (c >= 7) return 'playable';
  if (c >= 5) return 'speculative';
  return 'weak';
}

export function handShorthand(hole: Card[]): string {
  const [a, b] = hole.slice().sort((x, y) => y.rank - x.rank);
  const ch = (r: Rank) => (r === 10 ? 'T' : r > 10 ? 'JQKA'[r - 11] : String(r));
  if (a.rank === b.rank) return ch(a.rank) + ch(b.rank);
  return ch(a.rank) + ch(b.rank) + (a.suit === b.suit ? 's' : 'o');
}

export interface DrawInfo {
  flushDraw: boolean;
  openEnded: boolean;
  gutshot: boolean;
  /** Distinct unseen cards that complete a straight or flush using at least one hole card. */
  outs: Card[];
  /** Rough chance to hit by the river (rule of 4 on flop, 2 on turn), as a fraction. */
  hitChance: number;
}

function hasStraight(ranks: Set<number>): number {
  const r = new Set(ranks);
  if (r.has(14)) r.add(1);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = hi; k > hi - 5; k--) if (!r.has(k)) { ok = false; break; }
    if (ok) return hi;
  }
  return 0;
}

/** Flush and straight draw analysis for teaching outs. Only meaningful on flop/turn. */
export function analyzeDraws(hole: Card[], board: Card[]): DrawInfo {
  const none: DrawInfo = { flushDraw: false, openEnded: false, gutshot: false, outs: [], hitChance: 0 };
  if (board.length < 3 || board.length > 4) return none;
  const known = [...hole, ...board];
  const current = evaluateBest(known);
  if (current.category >= HandCategory.Straight) return none;

  const unseen = remainingDeck(known);
  const outs: Card[] = [];
  let flushOuts = 0;

  // flush: 4 of a suit including at least one hole card
  for (const suit of ['s', 'h', 'd', 'c'] as const) {
    const n = known.filter((c) => c.suit === suit).length;
    const fromHole = hole.some((c) => c.suit === suit);
    if (n === 4 && fromHole) {
      for (const c of unseen) if (c.suit === suit) { outs.push(c); flushOuts++; }
    }
  }
  // straight: cards that make a straight that actually uses a hole card
  const boardRanks = new Set(board.map((c) => c.rank));
  const allRanks = new Set(known.map((c) => c.rank));
  const straightRanks = new Set<number>();
  for (let r = 2; r <= 14; r++) {
    if (allRanks.has(r)) continue;
    const withR = new Set(allRanks).add(r);
    const hi = hasStraight(withR);
    if (!hi) continue;
    const boardOnly = hasStraight(new Set(boardRanks).add(r));
    if (boardOnly === hi) continue; // the board alone makes it; everyone has it
    straightRanks.add(r);
  }
  for (const c of unseen) {
    if (straightRanks.has(c.rank) && !outs.some((o) => sameCard(o, c))) { outs.push(c); }
  }
  const openEnded = straightRanks.size >= 2;
  const gutshot = straightRanks.size === 1;
  const perCard = board.length === 3 ? 4 : 2;
  return {
    flushDraw: flushOuts > 0,
    openEnded,
    gutshot,
    outs,
    hitChance: Math.min(1, (outs.length * perCard) / 100),
  };
}
