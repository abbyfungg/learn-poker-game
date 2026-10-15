import { HandCategory, evaluateBest, explainComparison } from '../engine/evaluator';
import { GameState, PlayerView } from '../engine/game';
import { Advice, Grade } from './advisor';
import { ConceptId } from './concepts';
import { CoachLevel } from './lessons';
import { Progress, mastery, weakSpots } from './progress';

/** data-coach attribute values the UI can spotlight. */
export type CoachTarget = 'actions' | 'pot' | 'hero-cards' | 'board' | 'button' | 'hints' | 'bet-sizer';

export interface Tip {
  id: string;
  concept: ConceptId;
  title: string;
  body: string;
  target?: CoachTarget;
  /** Intro tips are shown once ever. */
  once: boolean;
}

export interface TipContext {
  view: PlayerView;
  advice: Advice;
  progress: Progress;
  coach: CoachLevel;
  focus: ConceptId[];
  /** Best hand category the hero held on the previous street (for "you made a hand" moments). */
  prevCategory: HandCategory | null;
  shownThisHand: string[];
}

function shouldTeach(ctx: TipContext, concept: ConceptId, intro: boolean): boolean {
  if (ctx.coach === 'off') return false;
  const m = mastery(ctx.progress.concepts[concept]);
  if (intro) return m !== 'mastered';
  if (ctx.coach === 'full') return m === 'new' || m === 'learning' || ctx.focus.includes(concept) && m !== 'mastered';
  // light: only revisit weak spots
  return weakSpots(ctx.progress).includes(concept);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Pick at most one teaching moment for the player's decision point. */
export function teachingMoment(ctx: TipContext): Tip | null {
  const { view, advice, progress } = ctx;
  const seen = (id: string) => progress.seenTips.includes(id) || ctx.shownThisHand.includes(id);
  const l = view.legal!;
  const candidates: Tip[] = [];
  const add = (t: Tip) => {
    if (t.once && seen(t.id)) return;
    if (!t.once && ctx.shownThisHand.includes(t.id)) return;
    if (!shouldTeach(ctx, t.concept, t.once)) return;
    candidates.push(t);
  };

  add({
    id: 'intro-blinds', concept: 'blinds', once: true, target: 'button', title: 'Blinds start every pot',
    body: `The two players after the dealer button post forced bets — the small blind and the big blind (${view.bigBlind}). That gives everyone something to win. The button moves one seat each hand, so everyone takes a turn paying.`,
  });

  if (l.toCall > 0) {
    add({
      id: 'intro-facing-bet', concept: 'actions', once: true, target: 'actions', title: 'Someone has bet',
      body: `To stay in you must match the bet. Fold gives up the hand. Call puts in ${l.callAmount} to match. Raise makes it bigger, so others must pay more to continue.`,
    });
  } else {
    add({
      id: 'intro-free-action', concept: 'actions', once: true, target: 'actions', title: 'Nobody has bet yet',
      body: 'You can check — stay in without putting chips in — or bet to make others pay to continue.',
    });
  }

  if (view.phase === 'preflop') {
    if (view.position === 'BTN') add({
      id: 'intro-button', concept: 'position', once: true, target: 'button', title: 'You have the button',
      body: 'After the flop you will act last on every round. Seeing what everyone else does first is a real advantage, so you can play more hands from here.',
    });
    if (view.position === 'UTG') add({
      id: 'intro-early', concept: 'position', once: true, title: 'You act first',
      body: 'Everyone else acts after you, and any of them may have a strong hand. From early seats, play only your better hands.',
    });
    add({
      id: 'intro-starting', concept: 'starting-hands', once: true, target: 'hero-cards', title: 'Most hands are folds',
      body: 'Strong starting hands are pairs and high cards, especially if they are suited (same suit) or connected (close in rank). Folding weak hands before the flop costs nothing.',
    });
  }

  if (view.board.length >= 3) {
    const made = evaluateBest([...view.hole, ...view.board]);
    const usesHole = made.cards.some((c) => view.hole.some((h) => h.rank === c.rank && h.suit === c.suit));
    if (usesHole && made.category >= HandCategory.Pair && (ctx.prevCategory === null || made.category > ctx.prevCategory)) {
      add({
        id: `made-${made.category}`, concept: 'hand-rankings', once: true, target: 'hero-cards', title: `You have ${withArticle(made.name)}`,
        body: rankingBlurb(made.category),
      });
    }
    const d = advice.numbers.draws;
    if (d && d.outs.length >= 4 && view.board.length < 5) {
      add({
        id: 'intro-outs', concept: 'outs', once: true, target: 'board', title: 'You are drawing',
        body: `You're not there yet, but ${d.outs.length} unseen cards would complete your hand. These are your "outs". A quick estimate: multiply outs by 4 on the flop (two cards to come) or by 2 on the turn — about ${pct(d.hitChance)} here.`,
      });
      add({
        id: 'repeat-outs', concept: 'outs', once: false, target: 'board', title: `${d.outs.length} outs`,
        body: `Roughly ${pct(d.hitChance)} to hit by the river. Compare that with the price before you call.`,
      });
    }
    if (l.toCall > 0 && advice.numbers.potOdds !== undefined) {
      const po = advice.numbers.potOdds;
      add({
        id: 'intro-pot-odds', concept: 'pot-odds', once: true, target: 'pot', title: 'What does calling cost?',
        body: `You'd pay ${l.toCall} to win ${view.pot + l.toCall}. So you need to win at least ${pct(po)} of the time for a call to pay off in the long run. That's pot odds.`,
      });
      add({
        id: 'repeat-pot-odds', concept: 'pot-odds', once: false, target: 'pot', title: `You need ${pct(po)}`,
        body: `Call ${l.toCall} to win ${view.pot + l.toCall}. Does your hand win that often?`,
      });
    }
    if (l.toCall === 0 && advice.concepts.includes('value-betting')) {
      add({
        id: 'intro-value', concept: 'value-betting', once: true, target: 'bet-sizer', title: 'Strong hand, nobody bet',
        body: 'When you are probably ahead, betting lets worse hands pay you. If you check, they get to see more cards for free.',
      });
    }
  }
  return candidates[0] ?? null;
}

/** "Pair of Eights" → "a pair of eights"; "Two pair, …" stays as is. */
export function withArticle(name: string): string {
  const lower = name.toLowerCase();
  return /^(pair|straight|flush|full house|royal)/.test(lower) ? `a ${lower}` : lower;
}

function rankingBlurb(c: HandCategory): string {
  switch (c) {
    case HandCategory.Pair: return 'A pair beats any hand with no pair. If two players have the same pair, the next highest cards (kickers) decide.';
    case HandCategory.TwoPair: return 'Two pair beats one pair. Compare the higher pair first, then the lower pair, then the kicker.';
    case HandCategory.Trips: return 'Three of a kind beats two pair. With a pocket pair matching the board it is called a set — well hidden and strong.';
    case HandCategory.Straight: return 'Five cards in a row. A straight beats three of a kind; the highest top card wins between straights.';
    case HandCategory.Flush: return 'Five cards of one suit. A flush beats a straight; compare the highest card, then the next.';
    case HandCategory.FullHouse: return 'Three of a kind plus a pair. It beats a flush; the three-of-a-kind rank decides between full houses.';
    case HandCategory.Quads: return 'Four of a kind — very rare. Only a straight flush beats it.';
    case HandCategory.StraightFlush: return 'A straight all in one suit: the best hand in poker.';
    default: return '';
  }
}

export interface DecisionLog {
  grade: Grade;
  street: string;
}

/** Plain-language explanation of how the hand ended, plus decision-vs-outcome reflection. */
export function explainResult(s: GameState, heroSeat: number, decisions: DecisionLog[]): string[] {
  const r = s.result;
  if (!r) return [];
  const lines: string[] = [];
  const name = (seat: number) => (seat === heroSeat ? 'You' : s.players[seat].name);
  if (r.uncontested) {
    const w = r.pots[0].winners[0];
    lines.push(`${name(w)} won ${r.pots[0].amount} without a showdown — everyone else folded.`);
  } else {
    r.pots.forEach((pot, i) => {
      const potName = r.pots.length > 1 ? (i === 0 ? 'The main pot' : `Side pot ${i}`) : 'The pot';
      const winners = pot.winners.map(name).join(' and ');
      const hand = r.shown[pot.winners[0]];
      const losers = pot.eligible.filter((e) => !pot.winners.includes(e));
      let why = '';
      if (losers.length) {
        const bestLoser = losers.map((sid) => r.shown[sid]).sort((a, b) => b.score - a.score)[0];
        why = ' ' + explainComparison(hand, bestLoser);
      } else if (pot.winners.length > 1) {
        why = ' ' + explainComparison(hand, r.shown[pot.winners[1]]);
      }
      const verb = pot.winners.length > 1 ? 'split' : 'won';
      lines.push(`${potName} (${pot.amount}): ${winners} ${verb} with ${hand.name.toLowerCase()}.${why}`);
    });
    if (r.pots.length > 1) lines.push('Side pots form when someone is all-in: they can only win as much from each player as they put in themselves.');
  }
  if (r.returned) lines.push(`${r.returned.amount} of ${name(r.returned.seat) === 'You' ? 'your' : `${name(r.returned.seat)}'s`} bet wasn't called and was returned.`);

  const heroWon = (r.payouts[heroSeat] ?? 0) > 0;
  const heroDecisions = decisions.length;
  if (heroDecisions > 0) {
    const costly = decisions.filter((d) => d.grade === 'costly').length;
    if (heroWon && costly > 0) lines.push('You won the chips, but one of your decisions would lose money if you repeated it. Good results and good decisions are not the same thing.');
    else if (!heroWon && costly === 0 && !s.players[heroSeat].folded) lines.push('You lost this pot, but your decisions were sound given what you knew. Over many hands, those decisions win.');
  }
  return lines;
}
