# Design

Kicker is a Texas Hold'em table that teaches complete beginners by letting them play real hands. This file records the product and visual decisions. It was shaped with the `core-loop-designer`, `player-experience-modeler`, `economy-progression-designer`, `ui-ux-systems-designer` and `frontend-design` skills.

## Experience goals

- **Feels like a card room, not a worksheet.** The table is the screen; teaching lives in a side panel and in brief highlights on the table.
- **Competence, autonomy, relatedness** (self-determination theory). The player always makes the decision (autonomy). Feedback is about the quality of the decision, not the result (competence). Opponents have names and recognisable styles (relatedness).
- **Flow.** Each lesson adds one idea. Guidance fades as mastery rises, so the challenge grows with skill.

## Loops

| Loop | Time | Action → feedback → reward → decision |
|---|---|---|
| Micro | 5–20 s | Read the spot → act → seat label, chips move, coach grade → next street's decision |
| Core | 1–2 min | Play a hand → showdown explanation in plain words → chips, plus a "Solid/Reasonable/Costly" decision record → deal the next hand |
| Session | 5–10 min | A lesson with one concrete goal (e.g. "10 starting-hand decisions, 70% reasonable") → session review → next lesson or keep playing |
| Meta | days | Concept mastery bars in the lobby; weak spots are suggested for practice |

Attrition risks and how they're handled:
- Long bot turns → bots act in 0.65–1.1 s (0.25 s with reduced motion).
- Text walls → tips are 2–3 sentences, shown once, and only when they apply right now.
- Feeling judged by luck → hand-end notes separate the decision from the result.

## Teaching model

- **Teaching moments** (`src/coach/triggers.ts`) fire at the decision point where a concept becomes relevant. Intro tips show once ever. Repeat tips appear only while that concept is still being learned, or for weak spots when the coach is set to "Weak spots".
- **Hint ladder** (Nudge → Hint → Show me) is opt-in. Each level unlocks the next. "Show me" marks the suggested button as "Coach's pick". Using hints reduces the mastery credit a little, but never blocks play.
- **Grading** (`gradeDecision`) compares the action with advice computed from the player's own view at that moment. Close spots are graded leniently. Outcome never affects the grade.
- **Mastery** per concept is an exponentially weighted score: new → learning → comfortable → mastered.
- **Lessons** set the table size, the opponents and one measurable goal. The cards are always randomly shuffled; no demo hands are scripted.

| # | Lesson | Focus | Goal |
|---|---|---|---|
| 1 | Your first hands | actions, blinds | 4 hands |
| 2 | What beats what | hand rankings, showdowns | 3 showdowns (June calls a lot) |
| 3 | Choosing starting hands | starting hands | 10 decisions, 70% reasonable |
| 4 | Playing your position | position | 12 decisions, 70% |
| 5 | Draws and outs | outs | 3 draw decisions |
| 6 | Pot odds | pot odds | 6 decisions, 65% |
| 7 | Betting strong hands | value betting | 4 decisions, 65% |
| ∞ | Free play | weak spots | — |

## Opponents

Profiles live in `src/ai/bot.ts`: tight (Otto, Sol), calls a lot (June), solid-aggressive (Mara, Inès), loose-aggressive (Rex), and gentle beginners (Bo, Pia). Lessons choose opponents to create the situations they teach. Bots never see hidden cards and never throw hands on purpose.

## Visual system

**Direction:** a private card room at night. The table sits under a warm lamp. Everything outside the felt stays dark and quiet, so the table is the one memorable element.

| Token | Value | Use |
|---|---|---|
| Room | `#0b1411` | page background (deep green-black, per the brief) |
| Felt | `#145a41` → `#0a3125` | radial, lit from above, fine noise texture |
| Rail | `#5a3a26` → `#1f130c` | leather, with a brass inlay line `#b8955a` |
| Gold | `#c9a55c` | the active seat, the primary action, the dealer button highlight; used sparingly |
| Ivory | `#f3ecdd` | cards, chips, key text |
| Sage | `#8db19a` | everything the coach says or highlights |

- **Type:** Bodoni Moda for the brand, card indices and display numbers (it nods to classic playing-card faces). Instrument Sans for the interface, with tabular numbers.
- **Cards:** CSS cards in a 5:7 ratio. Corner indices are top-left and rotated bottom-right. Pips sit in the centre; J/Q/K use framed italic letters. The back is a green lattice. Small cards show only the index so they stay readable.
- **Chips:** stacked ellipses with striped edges, in six denominations.
- **Motion:** cards slide in as they are dealt; the board flips in sequence; bets slide to the pot when a street ends; the active seat has a gold ring and shimmer; winners lift their cards. With `prefers-reduced-motion`, motion is effectively off and bots act faster.
- **Layout:** desktop shows the table and a 340 px coach column. Below 860 px the table becomes portrait, the action bar sits under it, and the coach collapses to a one-line strip.

Avoided on purpose: a rounded-card SaaS kit, glassmorphism, emoji avatars, all-caps labels, and decorative gradients outside the table.
