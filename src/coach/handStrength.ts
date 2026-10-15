import { Card, Rank, createRng, fullDeck, rankName, rankPlural } from '../engine/cards';
import { HandCategory, evaluateBest } from '../engine/evaluator';
import { analyzeDraws, chenScore, estimateEquity } from '../ai/equity';
import { PositionName, positionGroup } from '../engine/game';

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: 'Weak',
  1: 'Marginal',
  2: 'Decent',
  3: 'Strong',
  4: 'Very strong',
};

export interface HandStrength {
  level: StrengthLevel;
  label: string;
  /** Short name: "King-Queen, same suit" or "Pair of Eights". */
  title: string;
  /** Plain-language reasons, one idea per line. */
  points: string[];
  /** Made-hand category once there is a board; null preflop. */
  category: HandCategory | null;
  /** Estimated chance to win against the players still in, if they held random cards. */
  equity?: number;
  /** Preflop only: share of all starting hands this one beats or ties. */
  percentile?: number;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

let chenTable: number[] | null = null;
/** Share of the 1,326 possible starting hands whose Chen score is at or below this one. */
export function startingPercentile(hole: Card[]): number {
  if (!chenTable) {
    const deck = fullDeck();
    chenTable = [];
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) chenTable.push(chenScore([deck[i], deck[j]]));
    chenTable.sort((a, b) => a - b);
  }
  const mine = chenScore(hole);
  let below = 0;
  for (const s of chenTable) if (s <= mine) below++;
  return below / chenTable.length;
}

function preflopStrength(hole: Card[], position?: PositionName | null): HandStrength {
  const [a, b] = hole.slice().sort((x, y) => y.rank - x.rank);
  const pair = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = a.rank - b.rank;
  const percentile = startingPercentile(hole);
  const chen = chenScore(hole);
  const level: StrengthLevel = chen >= 12 ? 4 : chen >= 9 ? 3 : chen >= 7 ? 2 : chen >= 5 ? 1 : 0;

  const points: string[] = [];
  if (pair) {
    if (a.rank >= 11) points.push('A high pair before the flop. This is one of the best ways to start.');
    else if (a.rank >= 7) points.push('A middle pair. Often good, but higher cards on the flop can beat it.');
    else points.push('A small pair. It usually needs to hit a third card (a "set") on the flop to win a big pot.');
  } else {
    const high = [a, b].filter((c) => c.rank >= 10).length;
    if (high === 2) points.push('Both cards are high (10 or above). If you pair one, it will often be the best pair.');
    else if (high === 1) points.push(`One high card (${rankName(a.rank)}). The other card is your "kicker", and a weak kicker can lose to the same pair with a better one.`);
    else points.push('No high cards. Even if you make a pair, someone with higher cards often has a better one.');
    if (suited) points.push('Same suit: you can make a flush, which adds a little value.');
    else points.push('Different suits: no easy flush.');
    if (gap === 1) points.push('Next to each other in rank: good for making straights.');
    else if (gap === 2) points.push('Close in rank: can still make some straights.');
    else if (gap >= 5) points.push('Far apart in rank: they rarely work together.');
  }
  points.push(`Better than about ${pct(percentile)} of all possible starting hands.`);
  if (position) {
    const group = positionGroup(position);
    if (group === 'late') points.push('Your seat helps: you act after most players, so you can play somewhat weaker hands here than the rating suggests.');
    else if (group === 'early') points.push('Your seat makes it harder: many players act after you, so stick to Strong and Very strong hands.');
    else if (group === 'blinds') points.push('You are in a blind, so you already have chips in. Calling costs less, but you will act early after the flop.');
  }

  const title = pair
    ? `Pair of ${rankPlural(a.rank)}`
    : `${rankName(a.rank)}-${rankName(b.rank)}, ${suited ? 'same suit' : 'different suits'}`;
  return { level, label: STRENGTH_LABELS[level], title, points, category: null, percentile };
}

function pairKind(hole: Card[], board: Card[], pairRank: Rank): string | null {
  const boardRanks = board.map((c) => c.rank).sort((x, y) => y - x);
  const pocketPair = hole[0].rank === hole[1].rank;
  if (pocketPair) {
    if (pairRank > boardRanks[0]) return 'an overpair: your pair is higher than every card on the board. Strong.';
    return 'a pocket pair below the highest board card. Anyone holding that higher card has you beaten.';
  }
  if (pairRank === boardRanks[0]) return 'top pair: you paired the highest card on the board. Usually a good hand.';
  if (pairRank === boardRanks[boardRanks.length - 1]) return 'bottom pair: you paired the lowest board card. Easily beaten.';
  return 'middle pair: some board cards are higher than your pair, so others may have a better pair.';
}

function postflopStrength(hole: Card[], board: Card[], opponents: number): HandStrength {
  const made = evaluateBest([...hole, ...board]);
  const usesHole = made.cards.some((c) => hole.some((h) => h.rank === c.rank && h.suit === c.suit));
  const seed = [...hole, ...board].reduce((n, c) => n * 31 + c.rank * 4 + 'shdc'.indexOf(c.suit), 3) >>> 0;
  const equity = estimateEquity(hole, board, Math.max(1, opponents), 400, createRng(seed));
  const level: StrengthLevel = equity >= 0.8 ? 4 : equity >= 0.6 ? 3 : equity >= 0.42 ? 2 : equity >= 0.25 ? 1 : 0;
  const points: string[] = [];

  if (!usesHole) {
    points.push(`Your best hand, ${made.name.toLowerCase()}, is made entirely from the shared cards. Everyone has it, so it can't beat anyone unless they have nothing better.`);
  } else if (made.category === HandCategory.Pair) {
    points.push(`You have ${pairKind(hole, board, made.ranks[0])}`);
  } else if (made.category === HandCategory.HighCard) {
    points.push(`No pair yet. Your highest card is a ${rankName(made.ranks[0])}. High card rarely wins when others keep betting.`);
  } else if (made.category === HandCategory.TwoPair) {
    const boardPaired = new Set(board.map((c) => c.rank)).size < board.length;
    points.push(boardPaired
      ? 'Two pair, but one pair is on the board for everyone, so it is weaker than it looks.'
      : 'Two pair using both your cards. A strong hand.');
  } else {
    points.push(`${made.name}. ${made.category >= HandCategory.Straight ? 'A big hand: you want more chips in the pot.' : 'A strong hand.'}`);
  }

  const draws = analyzeDraws(hole, board);
  if (draws.outs.length >= 4 && board.length < 5) {
    const what = draws.flushDraw ? 'a flush' : 'a straight';
    points.push(`You're also drawing to ${what}: ${draws.outs.length} cards would complete it (about ${pct(draws.hitChance)} by the river).`);
  }
  points.push(`Against ${opponents === 1 ? 'one opponent' : `${opponents} opponents`} holding random cards you'd win about ${pct(equity)}. Players who bet or raise usually have better than random cards.`);

  return { level, label: STRENGTH_LABELS[level], title: made.name, points, category: made.category, equity };
}

/** How good is this hand right now, in beginner terms? Uses only the player's own cards and the board. */
export function handStrength(hole: Card[], board: Card[], opponents: number, position?: PositionName | null): HandStrength {
  if (hole.length < 2) throw new Error('Need two hole cards');
  return board.length === 0 ? preflopStrength(hole, position) : postflopStrength(hole, board, opponents);
}
