import { createRng } from '../engine/cards';
import { CATEGORY_NAMES, HandCategory, evaluateBest } from '../engine/evaluator';
import { ActionType, PlayerView, PositionName, positionGroup } from '../engine/game';
import { DrawInfo, PreflopTier, analyzeDraws, estimateEquity, handShorthand, preflopTier } from '../ai/equity';
import { ConceptId } from './concepts';

export type Choice = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface Advice {
  /** The suggested action. */
  best: Choice;
  /** Suggested bet/raise-to amount, when best is bet/raise. */
  amount?: number;
  /** Other actions that are reasonable here. */
  fine: Choice[];
  /** Concepts this decision exercises (first is primary). */
  concepts: ConceptId[];
  /** Level 1: a question to think about. */
  nudge: string;
  /** Level 2: the facts and numbers. */
  hint: string;
  /** Level 3: the suggestion with reasoning. */
  showMe: string;
  /** How close the decision is: close decisions are graded leniently. */
  close: boolean;
  numbers: {
    equity?: number;
    potOdds?: number;
    draws?: DrawInfo;
    madeHand?: string;
    tier?: PreflopTier;
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

const POSITION_PHRASES: Record<PositionName, string> = {
  BTN: 'on the button', SB: 'in the small blind', BB: 'in the big blind', UTG: 'under the gun (first to act)',
  MP: 'in middle position', HJ: 'in the hijack', CO: 'in the cutoff (one before the button)',
};

const TIER_WORDS: Record<PreflopTier, string> = {
  premium: 'one of the best starting hands',
  strong: 'a strong starting hand',
  playable: 'a playable hand, better in late position',
  speculative: 'a speculative hand that needs a cheap flop and good position',
  weak: 'a weak hand — usually a fold unless few players are left to act',
};

/** Normalise "bet" vs "raise" to what is legal right now. */
function aggressive(view: PlayerView): Choice {
  return view.legal?.canBet ? 'bet' : 'raise';
}

function clampTo(view: PlayerView, to: number): number {
  const l = view.legal!;
  const unit = view.bigBlind / 2;
  const rounded = Math.round(to / unit) * unit;
  return Math.min(l.maxTo, Math.max(l.minTo, rounded));
}

/**
 * Advice for the player to act, using only their own view.
 * Strategy here is deliberately simple and beginner-oriented; it is a reasonable baseline, not a solver.
 */
export function advise(view: PlayerView, iterations = 700): Advice {
  if (!view.legal) throw new Error('Not your turn');
  return view.phase === 'preflop' ? advisePreflop(view) : advisePostflop(view, iterations);
}

function advisePreflop(view: PlayerView): Advice {
  const l = view.legal!;
  const bb = view.bigBlind;
  const tier = preflopTier(view.hole);
  const short = handShorthand(view.hole);
  const group = positionGroup(view.position);
  const posName = view.position ? POSITION_PHRASES[view.position] : 'in this seat';
  const raised = view.currentBet > bb;
  const concepts: ConceptId[] = ['starting-hands'];
  if ((tier === 'playable' || tier === 'speculative') && (group === 'late' || group === 'early')) concepts.push('position');

  const rank = { premium: 4, strong: 3, playable: 2, speculative: 1, weak: 0 }[tier];
  // fewer players left to act behind you → fewer hands that can beat you → play wider
  const behind = view.position === 'BTN' ? 2 : view.position === 'SB' ? 1 : view.position === 'BB' ? 0 : view.position === 'CO' ? 3 : 4;
  const posBonus = (group === 'late' ? 1 : group === 'early' ? -1 : 0) + (behind <= 2 && view.position !== 'BB' ? 1 : 0)
    + (view.playersDealt <= 3 ? 1 : 0);
  let best: Choice;
  let fine: Choice[] = [];
  let amount: number | undefined;
  let why: string;
  let close = false;

  if (!raised) {
    const limpers = view.log.filter((r) => r.street === 'preflop' && r.kind === 'call').length;
    const score = rank + posBonus;
    if (l.canCheck) {
      // big blind with the option
      if (rank >= 3) { best = 'raise'; fine = ['check']; amount = clampTo(view, bb * (3 + limpers)); why = `${short} is ${TIER_WORDS[tier]}, so raising builds a pot you are likely to win.`; }
      else { best = 'check'; fine = rank >= 2 ? ['raise'] : []; why = `Nobody raised, so you can see the flop for free. No reason to put more in with ${short}.`; }
    } else if (score >= 3 || (score >= 2 && limpers === 0)) {
      best = 'raise'; fine = rank >= 2 ? ['call'] : []; amount = clampTo(view, bb * (3 + limpers));
      why = `${short} is ${TIER_WORDS[tier]}. ${cap(posName)}, raising to about ${3 + limpers} big blinds is a standard way to play it.`;
      close = score === 2;
    } else if (score === 2 || (score === 1 && view.position === 'SB')) {
      best = limpers > 0 ? 'call' : 'fold'; fine = ['raise', 'call', 'fold'].filter((c) => c !== best) as Choice[];
      why = `${short} is ${TIER_WORDS[tier]}. ${cap(posName)} it's borderline — playing or folding are both defensible.`;
      close = true;
    } else {
      best = 'fold';
      why = group === 'early'
        ? `${short} is ${TIER_WORDS[tier]}. From early position many players act after you, so fold hands like this.`
        : `${short} is ${TIER_WORDS[tier]}. Folding costs nothing here; save chips for better spots.`;
    }
  } else {
    const priceBB = l.toCall / bb;
    if (rank >= 4) {
      best = 'raise'; fine = ['call']; amount = clampTo(view, view.currentBet * 3);
      why = `${short} is ${TIER_WORDS[tier]}. Re-raising gets more chips in while you are probably ahead.`;
    } else if (rank === 3 || (rank === 2 && (group === 'late' || view.position === 'BB') && priceBB <= 3)) {
      best = 'call'; fine = rank === 3 ? ['raise', 'fold'] : ['fold']; close = rank === 2;
      why = `Someone raised, which usually means a good hand. ${short} is ${TIER_WORDS[tier]}; calling to see a flop is reasonable${group === 'late' ? ', especially since you will act last after the flop' : ''}.`;
    } else {
      best = 'fold'; close = rank === 2;
      fine = close ? ['call'] : [];
      why = `Someone raised, which usually means a good hand. ${short} is ${TIER_WORDS[tier]} — it rarely beats a raising range, so folding is usually best.`;
    }
  }

  const nudge = raised
    ? 'Someone has raised. How does your hand compare with the hands people usually raise with?'
    : group === 'early'
      ? 'You are one of the first to act. How many players still get to act after you?'
      : 'Is this hand strong enough to put chips in? Think about your cards and where you sit.';
  const hint = `Your hand is ${short}: ${TIER_WORDS[tier]}. You are ${posName}${raised ? `, and it costs ${l.toCall} to call` : ''}.`;
  const showMe = `${label(best, amount)}. ${why}`;
  return { best, amount, fine, concepts, nudge, hint, showMe, close, numbers: { tier } };
}

function advisePostflop(view: PlayerView, iterations: number): Advice {
  const l = view.legal!;
  const opponents = view.opponents.length;
  // deterministic per spot so the same hint is shown each time it's asked for
  const seed = view.hole.concat(view.board).reduce((n, c) => n * 31 + c.rank * 4 + 'shdc'.indexOf(c.suit), 7) >>> 0;
  const equity = estimateEquity(view.hole, view.board, opponents, iterations, createRng(seed));
  const made = evaluateBest([...view.hole, ...view.board]);
  const draws = analyzeDraws(view.hole, view.board);
  const usesHole = made.cards.some((c) => view.hole.some((h) => h.rank === c.rank && h.suit === c.suit));
  const madeHand = usesHole ? made.name : `${made.name} (on the board — everyone shares it)`;
  const hasDraw = draws.outs.length >= 4 && view.board.length < 5;
  const concepts: ConceptId[] = [];

  let best: Choice;
  let fine: Choice[] = [];
  let amount: number | undefined;
  let why: string;
  let close = false;
  let potOdds: number | undefined;
  const drawText = hasDraw
    ? `You have ${drawName(draws)} with ${draws.outs.length} outs — roughly ${pct(draws.hitChance)} to hit by the river.`
    : '';

  if (l.toCall === 0) {
    const valueLine = Math.max(0.5, 1.3 / (opponents + 1));
    if (equity >= valueLine) {
      concepts.push('value-betting');
      best = aggressive(view); fine = equity < valueLine + 0.1 ? ['check'] : [];
      amount = clampTo(view, view.pot * 0.66);
      close = equity < valueLine + 0.08;
      why = `With ${madeHand.toLowerCase()} you win about ${pct(equity)} against ${opponents === 1 ? 'a random hand' : `${opponents} random hands`}. Betting lets worse hands pay you.`;
    } else if (hasDraw && opponents <= 2) {
      concepts.push('outs');
      best = 'check'; fine = [aggressive(view)]; close = true;
      why = `${drawText} Checking takes a free card; betting can also work because you can win by making them fold or by hitting.`;
    } else {
      best = 'check'; fine = opponents === 1 && equity > 0.35 ? [aggressive(view)] : [];
      why = `About ${pct(equity)} to win against random hands isn't enough to bet for value. Checking keeps the pot small.`;
    }
  } else {
    potOdds = l.toCall / (view.pot + l.toCall);
    concepts.push('pot-odds');
    if (hasDraw) concepts.push('outs');
    // bettors usually have better than random hands
    const betRatio = l.toCall / Math.max(1, view.pot);
    const adj = equity * (1 - 0.18 * Math.min(1.5, betRatio * 2));
    const margin = adj - potOdds;
    close = Math.abs(margin) < 0.06;
    if (adj >= 0.65 && l.canRaise) {
      best = 'raise'; fine = ['call']; amount = clampTo(view, view.currentBet * 2.5 + view.pot * 0.3);
      concepts.push('value-betting');
      why = `You are a strong favourite (about ${pct(equity)}). Raising builds the pot while you are ahead.`;
    } else if (margin >= 0) {
      best = 'call'; fine = close ? ['fold'] : [];
      why = `Calling ${l.toCall} to win ${view.pot + l.toCall} means you need to win ${pct(potOdds)} of the time. You estimate about ${pct(adj)} after allowing for the bet, so calling is profitable on average.`;
    } else {
      best = 'fold'; fine = close ? ['call'] : [];
      why = `You need to win ${pct(potOdds)} of the time to call, but you estimate about ${pct(adj)}. Folding saves chips over the long run, even though you'll sometimes fold the best hand.`;
    }
  }
  if (concepts.length === 0) concepts.push('hand-rankings');

  const nudge = l.toCall > 0
    ? 'Compare what it costs to call with what you could win. How often does your hand need to win?'
    : hasDraw
      ? 'Which cards would improve your hand? Count them.'
      : 'How strong is your hand right now compared to what others might hold?';
  const hint = [
    `You have ${madeHand.toLowerCase()}.`,
    drawText,
    potOdds !== undefined ? `Pot odds: call ${l.toCall} to win ${view.pot + l.toCall} → you need ${pct(potOdds)}.` : '',
    `Against ${opponents === 1 ? 'one random hand' : `${opponents} random hands`} you'd win about ${pct(equity)} (an estimate — real opponents' hands aren't random).`,
  ].filter(Boolean).join(' ');
  const showMe = `${label(best, amount)}. ${why}`;
  return { best, amount, fine, concepts, nudge, hint, showMe, close, numbers: { equity, potOdds, draws, madeHand } };
}

function drawName(d: DrawInfo) {
  if (d.flushDraw && (d.openEnded || d.gutshot)) return 'a flush draw and a straight draw';
  if (d.flushDraw) return 'a flush draw';
  if (d.openEnded) return 'an open-ended straight draw';
  return 'a gutshot straight draw';
}

export function label(c: Choice, amount?: number): string {
  switch (c) {
    case 'fold': return 'Fold';
    case 'check': return 'Check';
    case 'call': return 'Call';
    case 'bet': return amount ? `Bet ${amount}` : 'Bet';
    case 'raise': return amount ? `Raise to ${amount}` : 'Raise';
  }
}

export type Grade = 'solid' | 'okay' | 'costly';

export interface GradedDecision {
  grade: Grade;
  note: string;
}

/** Grade an action against the advice available at the time it was made — never against the outcome. */
export function gradeDecision(advice: Advice, taken: ActionType): GradedDecision {
  const t = taken as Choice;
  const same = (a: Choice, b: Choice) => a === b || ((a === 'bet' || a === 'raise') && (b === 'bet' || b === 'raise'));
  if (same(t, advice.best)) return { grade: 'solid', note: `Good decision. ${stripLabel(advice.showMe)}` };
  if (advice.fine.some((f) => same(f, t)) || advice.close) {
    return { grade: 'okay', note: `Reasonable — this one is close. A slightly stronger option was to ${label(advice.best, advice.amount).toLowerCase()}: ${stripLabel(advice.showMe)}` };
  }
  return { grade: 'costly', note: `This tends to cost chips over time. A better option was to ${label(advice.best, advice.amount).toLowerCase()}: ${stripLabel(advice.showMe)}` };
}

function stripLabel(s: string) {
  const i = s.indexOf('. ');
  return i >= 0 ? s.slice(i + 2) : s;
}

export function categoryLadder(category: HandCategory): string {
  const names = Object.values(CATEGORY_NAMES);
  return names.map((n, i) => (i === category ? `[${n}]` : n)).join(' < ');
}
