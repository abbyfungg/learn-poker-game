---
name: poker-learning-game
description: Project rules for this Texas Hold'em learning game. Use for any change to the poker engine, AI opponents, coach/tutorial, lessons, progress tracking, or the table UI in this repo — covers rules correctness, teaching principles, AI fairness, architecture boundaries, and the verify-before-claiming workflow.
---

# Poker Learning Game

A browser Texas Hold'em table (React + TypeScript + Vite) that teaches beginners by playing real hands. Read `docs/ARCHITECTURE.md` before structural changes.

## Where things live

| Layer | Path | May import |
|---|---|---|
| Engine (pure rules, no DOM/React) | `src/engine/` | nothing outside engine |
| AI opponents | `src/ai/` | engine |
| Coach: advice, triggers, grading, lessons, progress | `src/coach/` | engine, ai/equity |
| UI | `src/ui/`, `src/App.tsx` | everything |

The UI never decides legality, pot sizes, or winners. It calls `legalActions()` and `applyAction()` and renders the result. If you need a rule in the UI, add a function to the engine and test it.

## Rules the engine must get right

- **Deck/dealing**: 52 unique cards, seeded shuffle (`createRng(seed)`), hole cards dealt one at a time starting left of the button.
- **Blinds/positions**: SB is left of the button, BB next, UTG acts first preflop. **Heads-up exception**: the button posts SB, acts first preflop and last postflop. A short stack posts what it has and is all-in. Button moves to the next seat with chips.
- **Legal actions**: `check` only when nothing to call; `fold` only when facing a bet; `bet` only when no bet this street (min = big blind); `raise` amounts are *raise-to* totals, min = current bet + last full raise size. A player can always go all-in. An all-in short of a full raise reopens action for others to call but does **not** let players who already acted re-raise (`raiseLocked`).
- **Round end**: everyone live has acted since the last full bet/raise and matched the current bet (or is all-in). Uncalled excess is returned before pots are built. If ≤1 player can still act, run the board out to showdown.
- **Pots**: build side pots from each player's total `committed` (folded players' chips count toward the pot but they are never eligible). Award each pot separately; split ties evenly; odd chips go to the first eligible winner left of the button.
- **Evaluation**: best 5 of 7. Category order: high card < pair < two pair < trips < straight < flush < full house < quads < straight flush. Wheel (A-2-3-4-5) is a 5-high straight. Kickers break ties; equal five-card ranks split regardless of suits.

Every rule above has a test in `src/engine/*.test.ts`. When you touch rules, add a deterministic test using fixed cards (`parseCards('As Kd ...')`) or a fixed seed — never rely on random deals to cover an edge case.

## Teaching principles

- Teach inside real hands. A concept appears when the table makes it relevant (first time facing a bet → call/raise/fold; flush draw on the flop → outs). No walls of text, no quizzes that pause the game.
- The player always decides. Assistance is optional and escalates only when asked: **Nudge** (a question to consider) → **Hint** (the relevant facts and numbers) → **Show me** (a suggested action with the reasoning, and the button highlighted).
- Grade the *decision* on the information available at the time (hero's cards, board, pot, price), never the outcome. A good fold that would have won and a bad call that got lucky are both called what they are.
- Be honest about uncertainty: equity numbers are estimates against assumed ranges; say so. Use "usually", "a reasonable", not "always correct".
- Adapt: concepts with high mastery stop getting proactive tips; weak concepts are revisited. Plain words first; introduce a term (e.g. "outs") only with the situation that defines it.

## AI opponents

- Bots decide from `viewFor(state, seat)` only — it hides every other player's hole cards. Never pass full `GameState` into a decision or equity function. There is a test for this; keep it passing.
- Each profile (tight, loose, aggressive, passive) changes thresholds, sizing and bluff frequency; behaviour must stay believable (no folding the nuts, no random shoves with nothing at high frequency).
- Never make bots throw hands to reward the player. Difficulty comes from profile choice per lesson, not from cheating in either direction.
- Bot reasons are recorded but shown only in hand review after the hand ends (showing them live would leak hidden information).

## Engineering standards

- Pure engine: `applyAction(state, action)` returns a new state or throws on illegal input. Explicit phases (`preflop → flop → turn → river → showdown → complete`); `advanceStreet()` is a separate, explicit transition so the UI can animate.
- No hardcoded "demo" hands presented as gameplay. Lessons configure table size, opponents and focus concepts; cards are always really shuffled.
- Components are presentational (`Card`, `ChipStack`, `Seat`, `Pot`, `ActionBar`, `CoachPanel`). Visual tokens live in `src/styles/tokens.css`.
- Accessibility: every control is a real `<button>`/`<input>` with a label, visible focus ring, keyboard shortcuts (F/C/R), `prefers-reduced-motion` disables motion, cards have `aria-label`s ("Ace of spades"). Never rely on suit colour alone.
- Animations must never block input or delay legal actions longer than the bot "thinking" delay.

## Workflow

1. Read the code you are changing and its tests first.
2. Make small, incremental changes; keep existing behaviour unless the task is to change it.
3. Run `npm test` (Vitest, engine + coach) and `npm run build` (tsc + Vite). Both must pass.
4. For UI or flow changes, run the game (`npm run dev`, or the `dev` entry in `.claude/launch.json`) and check it in a real browser, and/or run `npm run test:e2e` (Playwright in installed Chrome, reduced motion). `?seed=N` makes deals reproducible. Look at screenshots at desktop (1440×900) and phone (375×812) widths.
5. Report what you verified and how. Do not claim something works without having run it.
6. Update `docs/ARCHITECTURE.md` / `README.md` when workflows or structure change.
