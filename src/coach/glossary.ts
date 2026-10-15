export interface GlossaryEntry {
  id: string;
  /** Display name in the glossary list. */
  term: string;
  /** Regex source (no flags) matching the word forms used in text, whole words only. */
  match: string;
  definition: string;
  group: 'Flow of a hand' | 'Actions' | 'Seats' | 'Hands' | 'Strategy';
}

export const GLOSSARY: GlossaryEntry[] = [
  // flow of a hand
  { id: 'hole-cards', term: 'Hole cards', match: 'hole cards?|private cards?', group: 'Flow of a hand', definition: 'Your two face-down cards. Only you can see them.' },
  { id: 'preflop', term: 'Pre-flop', match: 'pre-?flop', group: 'Flow of a hand', definition: 'The first betting round. Everyone has just their two private cards and no shared cards are out yet.' },
  { id: 'flop', term: 'Flop', match: 'flops?', group: 'Flow of a hand', definition: 'The first three shared cards, dealt face up in the middle at once. Everyone can use them. A betting round follows.' },
  { id: 'turn', term: 'Turn', match: 'the turn', group: 'Flow of a hand', definition: 'The fourth shared card. Another betting round follows.' },
  { id: 'river', term: 'River', match: 'river', group: 'Flow of a hand', definition: 'The fifth and last shared card, followed by the final betting round.' },
  { id: 'board', term: 'Board', match: 'the board|shared cards?|community cards?', group: 'Flow of a hand', definition: 'The face-up cards in the middle that every player can use. Your hand is the best five cards from your two plus these.' },
  { id: 'showdown', term: 'Showdown', match: 'showdowns?', group: 'Flow of a hand', definition: 'After the last bet, the players still in turn their cards over and the best five-card hand wins the pot.' },
  { id: 'pot', term: 'Pot', match: 'pots?', group: 'Flow of a hand', definition: 'All the chips bet so far in this hand. The winner takes it.' },
  { id: 'side-pot', term: 'Side pot', match: 'side pots?', group: 'Flow of a hand', definition: 'Extra pot made when someone is all-in. The all-in player cannot win chips they could not match.' },
  { id: 'blinds', term: 'Blinds', match: 'blinds', group: 'Flow of a hand', definition: 'Two forced bets posted before the cards are dealt (small blind and big blind), so there is always something to win.' },
  { id: 'small-blind', term: 'Small blind', match: 'small blind', group: 'Seats', definition: 'The forced half-size bet posted by the player just left of the dealer button.' },
  { id: 'big-blind', term: 'Big blind', match: 'big blinds?', group: 'Seats', definition: 'The forced full-size bet posted by the second player left of the button. Bet sizes are often counted in big blinds.' },

  // actions
  { id: 'check', term: 'Check', match: 'check(?:s|ed|ing)?', group: 'Actions', definition: 'Pass without putting chips in. Only allowed when nobody has bet this round.' },
  { id: 'bet', term: 'Bet', match: 'bet(?:s|ting)?', group: 'Actions', definition: 'Put chips in when nobody else has this round. Others must call, raise or fold to stay in.' },
  { id: 'call', term: 'Call', match: 'call(?:s|ed|ing)?', group: 'Actions', definition: 'Put in exactly enough chips to match the current bet and stay in the hand.' },
  { id: 'raise', term: 'Raise', match: 'rais(?:e|es|ed|ing)|re-raise[ds]?', group: 'Actions', definition: 'Increase the bet. Everyone else must now match the bigger amount to stay in.' },
  { id: 'fold', term: 'Fold', match: 'fold(?:s|ed|ing)?', group: 'Actions', definition: 'Give up the hand. You lose whatever you already put in, but nothing more.' },
  { id: 'all-in', term: 'All-in', match: 'all-in', group: 'Actions', definition: 'Betting every chip you have left. You can still win the part of the pot you matched.' },
  { id: 'limp', term: 'Limp', match: 'limp(?:s|ed|ing|ers?)?', group: 'Actions', definition: 'Just calling the big blind before the flop instead of raising.' },

  // seats
  { id: 'button', term: 'Button (dealer)', match: 'on the button|dealer button|the button', group: 'Seats', definition: 'The white "D" disc marks the dealer. That seat acts last after the flop, which is the best seat at the table. It moves one seat left every hand.' },
  { id: 'position', term: 'Position', match: 'position', group: 'Seats', definition: 'Where you sit compared with the button. Acting later means you see what others do first, which is an advantage.' },
  { id: 'utg', term: 'Under the gun', match: 'under the gun|UTG', group: 'Seats', definition: 'The first player to act before the flop (left of the big blind). The hardest seat, so play only strong hands from here.' },
  { id: 'cutoff', term: 'Cutoff', match: 'cutoff', group: 'Seats', definition: 'The seat just right of the button. A late, good seat.' },
  { id: 'hijack', term: 'Hijack', match: 'hijack', group: 'Seats', definition: 'Two seats right of the button. A middle-to-late seat.' },
  { id: 'early', term: 'Early position', match: 'early position|early seats?', group: 'Seats', definition: 'Seats that act first. Many players still act after you, so you need stronger hands.' },
  { id: 'late', term: 'Late position', match: 'late position', group: 'Seats', definition: 'Seats that act last (the button and cutoff). You can play more hands here.' },

  // hands
  { id: 'kicker', term: 'Kicker', match: 'kickers?', group: 'Hands', definition: 'Your other card when two players have the same pair. The higher kicker wins. Example: A-K beats A-Q on an ace-high board.' },
  { id: 'suited', term: 'Suited', match: 'suited|same suit', group: 'Hands', definition: 'Both your cards are the same suit (e.g. two hearts), so you can make a flush.' },
  { id: 'offsuit', term: 'Offsuit', match: 'offsuit|different suits', group: 'Hands', definition: 'Your two cards are different suits.' },
  { id: 'connected', term: 'Connected', match: 'connected|connectors?', group: 'Hands', definition: 'Cards next to each other in rank (like 9-8), so they can make straights.' },
  { id: 'pocket-pair', term: 'Pocket pair', match: 'pocket pairs?', group: 'Hands', definition: 'Your two private cards are a pair, like 7-7.' },
  { id: 'top-pair', term: 'Top pair', match: 'top pair', group: 'Hands', definition: 'You paired the highest card on the board. Usually good.' },
  { id: 'overpair', term: 'Overpair', match: 'overpair', group: 'Hands', definition: 'A pocket pair higher than every card on the board.' },
  { id: 'set', term: 'Set', match: 'a set|"set"', group: 'Hands', definition: 'Three of a kind made with a pocket pair plus one matching board card. Strong and well hidden.' },
  { id: 'two-pair', term: 'Two pair', match: 'two pair', group: 'Hands', definition: 'Two different pairs, like K-K and 7-7. Beats one pair.' },
  { id: 'straight', term: 'Straight', match: 'straights?', group: 'Hands', definition: 'Five cards in a row in rank, any suits (e.g. 5-6-7-8-9). Beats three of a kind.' },
  { id: 'flush', term: 'Flush', match: 'flush(?:es)?', group: 'Hands', definition: 'Any five cards of the same suit. Beats a straight.' },
  { id: 'full-house', term: 'Full house', match: 'full house', group: 'Hands', definition: 'Three of a kind plus a pair (e.g. J-J-J-7-7). Beats a flush.' },

  // strategy
  { id: 'draw', term: 'Draw', match: 'draws?|drawing', group: 'Strategy', definition: 'A hand that is not made yet but could become strong with the right card, like four cards to a flush.' },
  { id: 'outs', term: 'Outs', match: 'outs', group: 'Strategy', definition: 'The unseen cards that would complete your draw. More outs means a better chance to hit.' },
  { id: 'pot-odds', term: 'Pot odds', match: 'pot odds', group: 'Strategy', definition: 'The price of a call compared with the pot. Calling 20 to win 80 means you need to win at least 20% of the time.' },
  { id: 'value', term: 'Betting for value', match: 'for value|value bet', group: 'Strategy', definition: 'Betting a strong hand so that worse hands pay you.' },
  { id: 'bluff', term: 'Bluff', match: 'bluff(?:s|ed|ing)?', group: 'Strategy', definition: 'Betting a weak hand to make better hands fold.' },
];

const byId = new Map(GLOSSARY.map((g) => [g.id, g]));
export function glossaryEntry(id: string) {
  return byId.get(id);
}

// longest patterns first so "small blind" wins over "blinds", "pot odds" over "pot"
const ORDERED = GLOSSARY.slice().sort((a, b) => b.match.length - a.match.length);
const PATTERN = new RegExp(`\\b(?:${ORDERED.map((g) => `(${g.match})`).join('|')})\\b`, 'gi');

export type TextPart = string | { text: string; id: string };

/**
 * Split text into plain strings and glossary terms. Each term is marked only on its first
 * appearance in the text, so explanations stay readable.
 */
export function splitTerms(text: string, alreadyMarked: Set<string> = new Set()): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  PATTERN.lastIndex = 0;
  for (let m = PATTERN.exec(text); m; m = PATTERN.exec(text)) {
    const groupIndex = m.slice(1).findIndex((g) => g !== undefined);
    const entry = ORDERED[groupIndex];
    if (!entry || alreadyMarked.has(entry.id)) continue;
    alreadyMarked.add(entry.id);
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ text: m[0], id: entry.id });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
