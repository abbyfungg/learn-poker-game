import { Card } from '../engine/cards';
import { ActionRecord, GameState, Street } from '../engine/game';
import { Grade } from './advisor';
import { ConceptId } from './concepts';

export interface HeroDecision {
  /** Index into the hand's action log of the action this decision produced. */
  logIndex: number;
  street: Street;
  grade: Grade;
  note: string;
  hintLevel: number;
  concepts: ConceptId[];
}

export interface HandRecord {
  id: string;
  lessonId: string;
  handNumber: number;
  heroSeat: number;
  button: number;
  board: Card[];
  players: { seat: number; name: string; startStack: number; endStack: number; hole: Card[] | null; folded: boolean; out: boolean }[];
  actions: (ActionRecord & { reason?: string })[];
  decisions: HeroDecision[];
  summary: string[];
  heroNet: number;
}

const KEY = 'poker-coach-history-v1';
const MAX = 40;

export function buildRecord(
  s: GameState, lessonId: string, heroSeat: number, startStacks: number[], reasons: Record<number, string>,
  decisions: HeroDecision[], summary: string[],
): HandRecord {
  const showdown = !s.result?.uncontested;
  return {
    id: `${Date.now()}-${s.handNumber}`,
    lessonId,
    handNumber: s.handNumber,
    heroSeat,
    button: s.button,
    board: s.board.slice(),
    players: s.players.map((p) => ({
      seat: p.seat, name: p.name, startStack: startStacks[p.seat], endStack: p.stack, folded: p.folded, out: p.out,
      // only reveal what was actually shown at the table
      hole: p.seat === heroSeat || (showdown && !p.folded && !p.out) ? p.hole.slice() : null,
    })),
    actions: s.log.map((a, i) => ({ ...a, reason: reasons[i] })),
    decisions,
    summary,
    heroNet: s.players[heroSeat].stack - startStacks[heroSeat],
  };
}

export function loadHistory(): HandRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as HandRecord[]; } catch { return []; }
}

export function saveHistory(h: HandRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(h.slice(-MAX))); } catch { /* ignore */ }
}
