# Kicker — learn Texas Hold'em by playing

A browser poker table that teaches complete beginners through real hands. You play six-handed against opponents with distinct styles. A coach points things out as they become relevant and offers optional hints (Nudge → Hint → Show me). Each decision is graded on what you knew at the time, not on whether you won.

## Run it

Requires Node.js 18+ (`brew install node`).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # engine + coach unit tests (Vitest)
npm run build        # type-check + production build
npm run test:e2e     # browser tests (Playwright, uses your installed Google Chrome)
```

Add `?seed=123` to the URL to get a reproducible deck order. Keyboard: **F** fold, **C** check/call, **R** bet/raise, **N** next hand. In a replay, ← and → step through the actions.

Docs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (code structure and rules decisions) · [docs/DESIGN.md](docs/DESIGN.md) (teaching model, loops, visual system).

## Claude Code skills used in this project

Skills are folders containing a `SKILL.md`. Claude Code finds them automatically in `.claude/skills/` (this project) and `~/.claude/skills/` (every project). Each one can be invoked by name, e.g. `/frontend-design`. Claude also loads a skill on its own when your request matches its description.

| Skill | Source | Installed at | Purpose here |
|---|---|---|---|
| `poker-learning-game` | custom (this repo) | `.claude/skills/` | Rules correctness, teaching principles, AI fairness, architecture and verification workflow for this game |
| `core-loop-designer` | [baxatron-git/claude-game-design-suite](https://github.com/baxatron-git/claude-game-design-suite) (MIT) | `.claude/skills/` | Gameplay and session loops |
| `player-experience-modeler` | same | `.claude/skills/` | Flow, motivation, avoiding a quiz-like feel |
| `economy-progression-designer` | same | `.claude/skills/` | Lesson pacing and the mastery curve |
| `ui-ux-systems-designer` | same | `.claude/skills/` | Information hierarchy, feedback, onboarding through play |
| `game-balance-analyst` | same | `.claude/skills/` | Opponent difficulty and meaningful choices |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | `~/.claude/skills/` | Visual direction and design critique |
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `~/.claude/skills/` | React rendering and performance guidelines |
| `web-design-guidelines` | same | `~/.claude/skills/` | UI and accessibility audit (`/web-design-guidelines src/ui/*.tsx`). It fetches its rule list from GitHub each time it runs. |

How they were installed: each skill's folder was copied from a shallow clone of its repository on 2026-10-15, at commits anthropics/skills `dbd4588`, claude-game-design-suite `5dd265a` and vercel-labs/agent-skills `063bee9`. The game-design suite documents this copy method itself. For the other repos, copying a single skill folder is Claude Code's native skill mechanism. Their documented plugin and `npx skills` installers would have pulled in whole bundles of unrelated skills.

To update a skill, re-clone its repository and copy the folder again:

```bash
git clone --depth 1 https://github.com/baxatron-git/claude-game-design-suite /tmp/gds
cp -R /tmp/gds/core-loop-designer .claude/skills/
```

### Browser automation

- `@playwright/test` is a dev dependency, and `e2e/` contains the browser tests.
- The Claude desktop app has a built-in browser that Claude uses to play and screenshot the game during development. `.claude/launch.json` defines the `dev` server for it.
- Optional: Microsoft's [Playwright CLI](https://github.com/microsoft/playwright-cli) ships its own agent skill. Installing it is a global, machine-wide change, so it was left for you to decide:

  ```bash
  npm install -g @playwright/cli@latest
  playwright-cli install --skills
  ```
