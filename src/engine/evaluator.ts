import { Card, Rank, rankName, rankPlural } from './cards';

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High card',
  [HandCategory.Pair]: 'One pair',
  [HandCategory.TwoPair]: 'Two pair',
  [HandCategory.Trips]: 'Three of a kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full house',
  [HandCategory.Quads]: 'Four of a kind',
  [HandCategory.StraightFlush]: 'Straight flush',
};

export interface HandValue {
  category: HandCategory;
  /** Tie-break ranks in significance order (e.g. pair rank, then kickers). */
  ranks: Rank[];
  /** Single comparable number; higher wins. */
  score: number;
  /** The five cards making the hand. */
  cards: Card[];
  /** Human description: "Two pair, Kings and Sevens". */
  name: string;
}

function encode(category: HandCategory, ranks: Rank[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 16 + (ranks[i] ?? 0);
  return score;
}

/** Highest card of a straight within the given distinct ranks (desc), or 0. Handles the wheel. */
function straightHigh(ranksDesc: Rank[]): Rank {
  const set = new Set(ranksDesc);
  if (set.has(14)) set.add(1);
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) if (!set.has(r)) { ok = false; break; }
    if (ok) return high;
  }
  return 0;
}

function describe(category: HandCategory, ranks: Rank[]): string {
  const [a, b] = ranks;
  switch (category) {
    case HandCategory.HighCard: return `${rankName(a)}-high`;
    case HandCategory.Pair: return `Pair of ${rankPlural(a)}`;
    case HandCategory.TwoPair: return `Two pair, ${rankPlural(a)} and ${rankPlural(b)}`;
    case HandCategory.Trips: return `Three ${rankPlural(a)}`;
    case HandCategory.Straight: return `Straight, ${rankName(a)}-high`;
    case HandCategory.Flush: return `Flush, ${rankName(a)}-high`;
    case HandCategory.FullHouse: return `Full house, ${rankPlural(a)} full of ${rankPlural(b)}`;
    case HandCategory.Quads: return `Four ${rankPlural(a)}`;
    case HandCategory.StraightFlush: return a === 14 ? 'Royal flush' : `Straight flush, ${rankName(a)}-high`;
  }
}

/** Evaluate exactly five cards. */
export function evaluate5(cards: Card[]): HandValue {
  const sorted = cards.slice().sort((x, y) => y.rank - x.rank);
  const counts = new Map<Rank, number>();
  for (const c of sorted) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  // group ranks by (count desc, rank desc)
  const groups = [...counts.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0]);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);
  const distinct = groups.map((g) => g[0]).sort((x, y) => y - x);
  const sHigh = distinct.length === 5 ? straightHigh(distinct) : 0;

  let category: HandCategory;
  let ranks: Rank[];
  if (sHigh && isFlush) { category = HandCategory.StraightFlush; ranks = [sHigh]; }
  else if (groups[0][1] === 4) { category = HandCategory.Quads; ranks = [groups[0][0], groups[1][0]]; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { category = HandCategory.FullHouse; ranks = [groups[0][0], groups[1][0]]; }
  else if (isFlush) { category = HandCategory.Flush; ranks = sorted.map((c) => c.rank); }
  else if (sHigh) { category = HandCategory.Straight; ranks = [sHigh]; }
  else if (groups[0][1] === 3) { category = HandCategory.Trips; ranks = groups.map((g) => g[0]); }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { category = HandCategory.TwoPair; ranks = groups.map((g) => g[0]); }
  else if (groups[0][1] === 2) { category = HandCategory.Pair; ranks = groups.map((g) => g[0]); }
  else { category = HandCategory.HighCard; ranks = sorted.map((c) => c.rank); }

  // order the five cards for display: made part first, then kickers; wheel shows 5-4-3-2-A
  let display = sorted.slice().sort((x, y) => {
    const cx = counts.get(x.rank)!, cy = counts.get(y.rank)!;
    return cy - cx || y.rank - x.rank;
  });
  if ((category === HandCategory.Straight || category === HandCategory.StraightFlush) && sHigh === 5) {
    display = [...display.filter((c) => c.rank !== 14), ...display.filter((c) => c.rank === 14)];
  }

  return { category, ranks, score: encode(category, ranks), cards: display, name: describe(category, ranks) };
}

/** Best five-card hand from 5–7 cards. */
export function evaluateBest(cards: Card[]): HandValue {
  if (cards.length < 5) throw new Error('Need at least 5 cards');
  let best: HandValue | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const v = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || v.score > best.score) best = v;
          }
  return best!;
}

/** Fast score-only evaluation for simulations. */
export function scoreBest(cards: Card[]): number {
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const s = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]).score;
            if (s > best) best = s;
          }
  return best;
}

/**
 * Describe the hand made from fewer than five cards (e.g. two hole cards preflop):
 * "Pair of Nines" or "Ace-King".
 */
export function describePartial(cards: Card[]): string {
  if (cards.length >= 5) return evaluateBest(cards).name;
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  if (ranks.length === 2 && ranks[0] === ranks[1]) return `Pair of ${rankPlural(ranks[0])}`;
  return ranks.map(rankName).join('-');
}

/** Explain why `a` beats `b` (or that they tie) in plain words. */
export function explainComparison(a: HandValue, b: HandValue): string {
  if (a.score === b.score) return `Both players have ${a.name.toLowerCase()} with the same five-card hand, so the pot is split.`;
  const [win, lose] = a.score > b.score ? [a, b] : [b, a];
  if (win.category !== lose.category) {
    return `${CATEGORY_NAMES[win.category]} beats ${CATEGORY_NAMES[lose.category].toLowerCase()}.`;
  }
  for (let i = 0; i < win.ranks.length; i++) {
    if (win.ranks[i] !== lose.ranks[i]) {
      const isKicker =
        (win.category === HandCategory.Pair && i > 0) ||
        (win.category === HandCategory.TwoPair && i > 1) ||
        (win.category === HandCategory.Trips && i > 0) ||
        (win.category === HandCategory.Quads && i > 0) ||
        win.category === HandCategory.HighCard ||
        win.category === HandCategory.Flush;
      const label = isKicker && i > 0 ? 'kicker' : 'card';
      return `Both have ${CATEGORY_NAMES[win.category].toLowerCase()}; the higher ${label} decides it (${rankName(win.ranks[i])} over ${rankName(lose.ranks[i])}).`;
    }
  }
  return '';
}
