import { CONCEPT_ORDER, ConceptId } from './concepts';
import { Grade } from './advisor';

export interface ConceptStats {
  seen: number;
  solid: number;
  okay: number;
  costly: number;
  hintsUsed: number;
  /** Exponentially weighted recent performance, 0..1. */
  score: number;
}

export type Mastery = 'new' | 'learning' | 'comfortable' | 'mastered';

export interface Progress {
  version: 1;
  concepts: Record<ConceptId, ConceptStats>;
  lessonsDone: string[];
  /** Teaching moments already shown (ids), so intros are not repeated. */
  seenTips: string[];
  handsPlayed: number;
}

const KEY = 'poker-coach-progress-v1';

export function emptyProgress(): Progress {
  const concepts = {} as Record<ConceptId, ConceptStats>;
  for (const id of CONCEPT_ORDER) concepts[id] = { seen: 0, solid: 0, okay: 0, costly: 0, hintsUsed: 0, score: 0.5 };
  return { version: 1, concepts, lessonsDone: [], seenTips: [], handsPlayed: 0 };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Progress;
    const base = emptyProgress();
    return { ...base, ...parsed, concepts: { ...base.concepts, ...parsed.concepts } };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: progress lasts this session */ }
}

const GRADE_VALUE: Record<Grade, number> = { solid: 1, okay: 0.6, costly: 0 };

/** Record a graded decision for the given concepts. Hints reduce the credit a little. */
export function recordDecision(p: Progress, concepts: ConceptId[], grade: Grade, hintLevel: number): Progress {
  const next: Progress = { ...p, concepts: { ...p.concepts } };
  for (const id of concepts) {
    const c = { ...next.concepts[id] };
    c.seen += 1;
    c[grade] += 1;
    if (hintLevel > 0) c.hintsUsed += 1;
    const value = GRADE_VALUE[grade] * (hintLevel >= 3 ? 0.5 : hintLevel === 2 ? 0.8 : 1);
    c.score = c.score * 0.7 + value * 0.3;
    next.concepts[id] = c;
  }
  return next;
}

export function mastery(c: ConceptStats): Mastery {
  if (c.seen < 2) return 'new';
  if (c.seen >= 8 && c.score >= 0.82) return 'mastered';
  if (c.seen >= 4 && c.score >= 0.7) return 'comfortable';
  return 'learning';
}

export const MASTERY_LABELS: Record<Mastery, string> = {
  new: 'New', learning: 'Learning', comfortable: 'Comfortable', mastered: 'Mastered',
};

/** Concepts the player has practised but is struggling with, weakest first. */
export function weakSpots(p: Progress): ConceptId[] {
  return CONCEPT_ORDER
    .filter((id) => p.concepts[id].seen >= 3 && p.concepts[id].score < 0.62)
    .sort((a, b) => p.concepts[a].score - p.concepts[b].score);
}

export function markTip(p: Progress, id: string): Progress {
  return p.seenTips.includes(id) ? p : { ...p, seenTips: [...p.seenTips, id] };
}
