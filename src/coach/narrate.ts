import { ActionRecord, GameState, Phase } from '../engine/game';

/** One-line explanation of where we are in the hand. */
export function streetIntro(phase: Phase): string {
  switch (phase) {
    case 'preflop': return 'Pre-flop: everyone has two private cards and no shared cards are out yet. Betting starts with the player after the big blind.';
    case 'flop': return 'The flop: three shared cards are out. Everyone combines them with their own two cards.';
    case 'turn': return 'The turn: a fourth shared card. One more card to come after this round.';
    case 'river': return 'The river: the fifth and last shared card. This is the final round of betting.';
    case 'showdown':
    case 'complete': return 'The hand is over.';
  }
}

/** Plain-English sentence for one action, with what it means. */
export function describeAction(r: ActionRecord, name: string): string {
  const you = name === 'You';
  if (r.allIn && r.kind !== 'fold' && r.kind !== 'post-sb' && r.kind !== 'post-bb') {
    return `${name} went all-in for ${r.betTo}: ${you ? 'every chip you had' : 'every chip they had'} is now in the pot.`;
  }
  switch (r.kind) {
    case 'post-sb': return `${name} posted the small blind (${r.added}), a forced bet.`;
    case 'post-bb': return `${name} posted the big blind (${r.added}), a forced bet.`;
    case 'fold': return `${name} folded and ${you ? 'are' : 'is'} out of this hand.`;
    case 'check': return `${name} checked: no bet, just passed the turn along.`;
    case 'call': return `${name} called ${r.added} to match the bet and stay in.`;
    case 'bet': return `${name} bet ${r.betTo}. Everyone else must now call, raise, or fold.`;
    case 'raise': return `${name} raised to ${r.betTo}, making it more expensive to continue. Raises usually mean a good hand, though sometimes it's a bluff.`;
  }
}

export interface Narration {
  street: string;
  /** Recent actions on this street, oldest first. */
  lines: string[];
  /** What the player can do right now, if it's their turn. */
  prompt?: string;
}

export function narrate(s: GameState, heroSeat: number, max = 4): Narration {
  const name = (seat: number) => (seat === heroSeat ? 'You' : s.players[seat].name);
  const street = s.phase === 'complete' || s.phase === 'showdown' ? null : s.phase;
  const recent = street ? s.log.filter((r) => r.street === street) : [];
  const lines = recent.slice(-max).map((r) => describeAction(r, name(r.seat)));
  let prompt: string | undefined;
  if (s.toAct === heroSeat) {
    const toCall = Math.max(0, s.currentBet - s.players[heroSeat].bet);
    prompt = toCall > 0
      ? `Your turn. It costs ${Math.min(toCall, s.players[heroSeat].stack)} to keep playing: call to stay in, raise to bet more, or fold to give up.`
      : 'Your turn. Nobody has bet, so you can check for free, or bet to make others pay to continue.';
  }
  return { street: streetIntro(s.phase), lines, prompt };
}
