export type Suit = 's' | 'h' | 'd' | 'c';
/** 2..14, where 11=J, 12=Q, 13=K, 14=A */
export type Rank = number;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_CHARS: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export const SUIT_NAMES: Record<Suit, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
export const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

const RANK_NAMES: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
const RANK_PLURALS: Record<number, string> = { 6: 'Sixes' };

export function rankName(rank: Rank): string {
  return RANK_NAMES[rank];
}

export function rankPlural(rank: Rank): string {
  return RANK_PLURALS[rank] ?? `${RANK_NAMES[rank]}s`;
}

export function rankLabel(rank: Rank): string {
  if (rank <= 9) return String(rank);
  return ({ 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[rank];
}

export function cardName(card: Card): string {
  return `${rankName(card.rank)} of ${SUIT_NAMES[card.suit]}`;
}

export function cardCode(card: Card): string {
  const r = Object.keys(RANK_CHARS).find((k) => RANK_CHARS[k] === card.rank)!;
  return `${r}${card.suit}`;
}

export function parseCard(code: string): Card {
  const rank = RANK_CHARS[code[0].toUpperCase()];
  const suit = code[1]?.toLowerCase() as Suit;
  if (!rank || !SUITS.includes(suit)) throw new Error(`Bad card code: ${code}`);
  return { rank, suit };
}

/** parseCards('As Kd 7h') */
export function parseCards(codes: string): Card[] {
  return codes.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

export type Rng = () => number;

/** Mulberry32: small, fast, seedable PRNG so hands can be reproduced in tests and replays. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function remainingDeck(known: Card[]): Card[] {
  return fullDeck().filter((c) => !known.some((k) => sameCard(c, k)));
}
