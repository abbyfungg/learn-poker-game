# Architecture

```
src/
  engine/   pure Texas Hold'em rules — no React, no DOM
    cards.ts       cards, parsing, seeded RNG (mulberry32), shuffle
    evaluator.ts   best-of-7 evaluation, hand names, plain-English comparison
    game.ts        state machine: startHand → applyAction* → advanceStreet* → complete
    testUtils.ts   rigged decks for deterministic tests
  ai/
    equity.ts      Monte Carlo equity, Chen preflop score, draw/outs analysis
    bot.ts         opponent profiles and decide(view, profile, rng)
  coach/
    advisor.ts     beginner-strategy advice + Nudge/Hint/Show me text; gradeDecision
    triggers.ts    teaching moments; end-of-hand explanation
    narrate.ts     plain-English play-by-play of the current street
    handStrength.ts  beginner hand rating (Weak → Very strong) with reasons
    glossary.ts    poker-word definitions and the matcher that underlines them
    lessons.ts     lesson definitions and goals
    progress.ts    per-concept mastery (localStorage)
    history.ts     hand records for replay (localStorage)
  game/useGame.ts  the only bridge: drives bots and timing, calls the coach, records hands
  ui/              presentational components (Card, Chips, Table, ActionBar, CoachPanel, Lobby, HandReplay, SessionReview, HandGuide, Term)
  styles/          tokens.css (design tokens) and app.css
e2e/               Playwright browser tests
```

## Decisions

1. **The engine is pure and explicit.** `applyAction` validates against `legalActions` and throws `IllegalActionError` on illegal input. Closing a betting round sets `toAct = null`. The UI then calls `advanceStreet()` itself, which leaves room for the bet-sweep animation and the run-out pacing. Nothing in `ui/` computes rules.
2. **Hidden information is enforced by type.** Bots and the coach receive a `PlayerView` from `viewFor(state, seat)`. It contains only that seat's hole cards. A test checks that a view never contains opponents' cards.
3. **Raise sizes use "raise to" totals.** The engine tracks `minRaise` (the last full raise) and `raiseLocked`. An incomplete all-in raise lets players call but does not let players who already acted re-raise.
4. **Pots are built from total contributions** (`buildPots`). Uncalled chips are returned before pots are built. Odd chips go to the first winner left of the button.
5. **Reproducibility.** Every shuffle uses a seeded RNG. Add `?seed=N` to the URL to replay the same deck order; the browser tests use this.
6. **The coach is a baseline, not a solver.** The advice uses Chen-score tiers by position preflop. Postflop it compares Monte Carlo equity against random hands, discounted when facing bets, with the pot odds. The text says plainly that these numbers are estimates.
7. **Persistence is local.** Progress and the last 40 hands are stored in `localStorage`. There is no backend.

## Testing

- `npm test` runs the Vitest unit tests: evaluator categories and kickers, blinds and heads-up order, min-raise and incomplete all-in rules, side pots, split pots with the odd chip, uncalled bets, run-outs, hidden-information views, and a 400-hand random-play invariant (chips conserved, every hand terminates). It also covers bot legality, equity and outs, advice and grading, mastery, teaching-moment gating, and showdown explanations.
- `npm run test:e2e` runs Playwright in the installed Google Chrome with reduced motion. It plays lesson 1 to its review, escalates the hint ladder, opens a hand replay, and checks the phone layout for overflow.
