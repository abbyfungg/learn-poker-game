import { Rng } from '../engine/cards';
import { Action, PlayerView, positionGroup } from '../engine/game';
import { chenScore, estimateEquity } from './equity';

export type Style = 'rock' | 'station' | 'shark' | 'maniac' | 'gentle';

export interface BotProfile {
  id: string;
  name: string;
  style: Style;
  /** One-line description shown at the table. */
  blurb: string;
  /** Chen score needed to open-raise from middle position. */
  openAt: number;
  /** Multiplier on pot odds when deciding to call (lower = calls more). */
  callFactor: number;
  /** Equity needed to bet/raise for value postflop. */
  valueAt: number;
  /** Chance to bet as a bluff when checked to. */
  bluff: number;
  /** Limps (calls) instead of raising with playable hands. */
  passive: boolean;
}

export const STYLE_LABELS: Record<Style, string> = {
  rock: 'Tight & cautious',
  station: 'Calls a lot',
  shark: 'Solid & aggressive',
  maniac: 'Loose & aggressive',
  gentle: 'Easy-going beginner',
};

export const BOTS: BotProfile[] = [
  { id: 'mara', name: 'Mara', style: 'shark', blurb: 'Plays few hands, but plays them hard.', openAt: 8, callFactor: 1.0, valueAt: 0.58, bluff: 0.12, passive: false },
  { id: 'otto', name: 'Otto', style: 'rock', blurb: 'Waits patiently for big hands.', openAt: 10, callFactor: 1.25, valueAt: 0.65, bluff: 0.03, passive: false },
  { id: 'june', name: 'June', style: 'station', blurb: 'Hates folding. Will call to see what you have.', openAt: 6, callFactor: 0.7, valueAt: 0.68, bluff: 0.04, passive: true },
  { id: 'rex', name: 'Rex', style: 'maniac', blurb: 'Bets and raises constantly.', openAt: 5, callFactor: 0.85, valueAt: 0.5, bluff: 0.35, passive: false },
  { id: 'ines', name: 'Inès', style: 'shark', blurb: 'Patient, positional, hard to read.', openAt: 7.5, callFactor: 1.0, valueAt: 0.6, bluff: 0.15, passive: false },
  { id: 'bo', name: 'Bo', style: 'gentle', blurb: 'New to the game, plays straightforwardly.', openAt: 7, callFactor: 1.1, valueAt: 0.62, bluff: 0.02, passive: true },
  { id: 'pia', name: 'Pia', style: 'gentle', blurb: 'Cautious and honest: bets mean strength.', openAt: 8, callFactor: 1.15, valueAt: 0.6, bluff: 0.0, passive: true },
  { id: 'sol', name: 'Sol', style: 'rock', blurb: 'Folds a lot, but watch out when Sol bets.', openAt: 9.5, callFactor: 1.2, valueAt: 0.63, bluff: 0.05, passive: false },
];

export interface BotDecision {
  action: Action;
  /** Shown only in hand review, after the hand ends. */
  reason: string;
}

function roundChips(x: number, unit: number) {
  return Math.max(unit, Math.round(x / unit) * unit);
}

function sized(view: PlayerView, to: number): Action {
  const l = view.legal!;
  let amount = roundChips(to, Math.max(1, view.bigBlind / 2));
  amount = Math.min(l.maxTo, Math.max(l.minTo, amount));
  if (amount > l.maxTo * 0.8) amount = l.maxTo; // don't leave a silly sliver behind
  return { type: l.canBet ? 'bet' : 'raise', amount };
}

function passiveFallback(view: PlayerView): Action {
  const l = view.legal!;
  return l.canCheck ? { type: 'check' } : { type: 'fold' };
}

/**
 * Decide an action from the bot's own view of the table.
 * PlayerView never contains other players' hole cards, so bots can't cheat.
 */
export function decide(view: PlayerView, bot: BotProfile, rng: Rng): BotDecision {
  const l = view.legal;
  if (!l) throw new Error('Bot asked to act when it is not its turn');
  return view.phase === 'preflop' ? preflop(view, bot, rng) : postflop(view, bot, rng);
}

function preflop(view: PlayerView, bot: BotProfile, rng: Rng): BotDecision {
  const l = view.legal!;
  const bb = view.bigBlind;
  const chen = chenScore(view.hole);
  const group = positionGroup(view.position);
  const posAdj = group === 'late' ? -1.5 : group === 'early' ? 1 : group === 'blinds' ? 0.5 : 0;
  const open = bot.openAt + posAdj;
  const raised = view.currentBet > bb;
  const raises = view.log.filter((r) => r.street === 'preflop' && (r.kind === 'raise' || r.kind === 'bet')).length;
  const stackBB = (view.stack + view.myBet) / bb;

  if (!raised) {
    const limpers = view.log.filter((r) => r.street === 'preflop' && r.kind === 'call').length;
    if (chen >= open || (bot.style === 'maniac' && rng() < 0.25 && chen >= open - 3)) {
      if (bot.passive && chen < open + 4 && l.callAmount > 0) {
        return { action: { type: 'call' }, reason: `${bot.name} liked the hand enough to play but prefers just calling.` };
      }
      if (l.canRaise) {
        const to = bb * (3 + limpers);
        return { action: sized(view, stackBB < 15 ? view.stack + view.myBet : to), reason: chen >= open ? `${bot.name} opened with a hand worth playing from this position.` : `${bot.name} raised a marginal hand — that's ${bot.name}'s aggressive style.` };
      }
    }
    if (l.canCheck) return { action: { type: 'check' }, reason: `${bot.name} took the free look from the big blind.` };
    if (bot.style === 'station' && chen >= open - 2 && l.callAmount <= bb) {
      return { action: { type: 'call' }, reason: `${bot.name} called cheaply to see a flop.` };
    }
    return { action: { type: 'fold' }, reason: `${bot.name} folded a hand below their starting standard.` };
  }

  // facing a raise
  const priceBB = l.toCall / bb;
  const reraiseAt = open + 4.5 + raises;
  const callAt = open + 2 + Math.min(3, priceBB / 4) - (bot.style === 'station' ? 2.5 : 0);
  if (chen >= reraiseAt && l.canRaise) {
    return { action: sized(view, view.currentBet * 3), reason: `${bot.name} re-raised with a strong starting hand.` };
  }
  if (chen >= callAt && l.callAmount > 0) {
    return { action: { type: 'call' }, reason: `${bot.name} called the raise with a decent hand.` };
  }
  if (bot.style === 'maniac' && rng() < 0.08 && l.canRaise) {
    return { action: sized(view, view.currentBet * 3), reason: `${bot.name} re-raised as a bluff — it happens with aggressive players.` };
  }
  return { action: passiveFallback(view), reason: `${bot.name} didn't think the hand was worth the price of the raise.` };
}

function postflop(view: PlayerView, bot: BotProfile, rng: Rng): BotDecision {
  const l = view.legal!;
  const opponents = view.opponents.length;
  const raw = estimateEquity(view.hole, view.board, opponents, 220, rng);
  // players who bet usually hold better-than-random hands: discount equity against big bets
  const betRatio = view.pot > 0 ? l.toCall / view.pot : 0;
  const eq = raw * (1 - 0.18 * Math.min(1.5, betRatio * 2));
  const pct = Math.round(raw * 100);

  if (l.toCall === 0) {
    if (eq >= bot.valueAt && (l.canBet || l.canRaise)) {
      return { action: sized(view, view.pot * (0.5 + rng() * 0.25)), reason: `${bot.name} bet for value (about ${pct}% to win against random hands).` };
    }
    if (opponents <= 2 && rng() < bot.bluff && (l.canBet || l.canRaise)) {
      return { action: sized(view, view.pot * 0.6), reason: `${bot.name} bluffed — betting a weak hand to make others fold.` };
    }
    return { action: { type: 'check' }, reason: `${bot.name} checked with a hand not strong enough to bet (about ${pct}%).` };
  }

  const potOdds = l.toCall / (view.pot + l.toCall);
  if (eq >= bot.valueAt + 0.12 && l.canRaise) {
    return { action: sized(view, view.currentBet * 2.5 + view.pot * 0.3), reason: `${bot.name} raised with a strong hand (about ${pct}%).` };
  }
  if (eq >= potOdds * bot.callFactor) {
    return { action: { type: 'call' }, reason: `${bot.name} called: needed ${Math.round(potOdds * 100)}% and estimated about ${pct}%.` };
  }
  if (bot.style === 'maniac' && opponents === 1 && rng() < 0.1 && l.canRaise) {
    return { action: sized(view, view.currentBet * 2.5), reason: `${bot.name} raised as a bluff.` };
  }
  return { action: { type: 'fold' }, reason: `${bot.name} folded: needed ${Math.round(potOdds * 100)}% and had about ${pct}%.` };
}
