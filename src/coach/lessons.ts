import { ConceptId } from './concepts';

export type CoachLevel = 'full' | 'light' | 'off';

export interface LessonGoal {
  /** What counts towards completion. */
  metric: 'hands' | 'showdowns' | 'decisions';
  count: number;
  /** For 'decisions': which concept's decisions count. */
  concept?: ConceptId;
  /** Share of counted decisions that must be solid or okay. */
  passRate?: number;
}

export interface Lesson {
  id: string;
  title: string;
  /** One line shown in the lesson picker. */
  pitch: string;
  /** Shown at the start, in the coach panel. Two sentences at most. */
  intro: string;
  focus: ConceptId[];
  /** Bot ids from BOTS, seated clockwise after the player. */
  opponents: string[];
  goal: LessonGoal;
  coach: CoachLevel;
}

export const LESSONS: Lesson[] = [
  {
    id: 'first-hands', title: 'Your first hands', pitch: 'How a hand flows, and what each button does.',
    intro: 'Play a few hands at a quiet table. The coach will point things out as they happen — just play.',
    focus: ['actions', 'blinds'], opponents: ['bo', 'pia'], goal: { metric: 'hands', count: 4 }, coach: 'full',
  },
  {
    id: 'what-beats-what', title: 'What beats what', pitch: 'Learn hand rankings from real showdowns.',
    intro: 'June calls a lot, so you will see plenty of showdowns. Watch how each winner is decided.',
    focus: ['hand-rankings', 'showdown'], opponents: ['june', 'bo'], goal: { metric: 'showdowns', count: 3 }, coach: 'full',
  },
  {
    id: 'starting-hands', title: 'Choosing starting hands', pitch: 'Which two cards are worth playing.',
    intro: 'Six players now. Most hands should be folded before the flop — the skill is choosing which ones to play.',
    focus: ['starting-hands'], opponents: ['mara', 'bo', 'june', 'otto', 'pia'],
    goal: { metric: 'decisions', concept: 'starting-hands', count: 10, passRate: 0.7 }, coach: 'full',
  },
  {
    id: 'position', title: 'Playing your position', pitch: 'Why the button is the best seat at the table.',
    intro: 'The later you act, the more you know. Notice how your seat changes which hands are worth playing.',
    focus: ['position', 'starting-hands'], opponents: ['ines', 'june', 'otto', 'bo', 'rex'],
    goal: { metric: 'decisions', concept: 'starting-hands', count: 12, passRate: 0.7 }, coach: 'full',
  },
  {
    id: 'draws', title: 'Draws and outs', pitch: 'Count the cards that can save your hand.',
    intro: 'When you are one card away from a straight or flush, the coach will help you count your outs.',
    focus: ['outs', 'pot-odds'], opponents: ['june', 'bo', 'mara'],
    goal: { metric: 'decisions', concept: 'outs', count: 3 }, coach: 'full',
  },
  {
    id: 'pot-odds', title: 'Pot odds', pitch: 'Is this call worth the price?',
    intro: 'Facing a bet, compare the price of calling with how often you will win.',
    focus: ['pot-odds'], opponents: ['rex', 'june', 'mara'],
    goal: { metric: 'decisions', concept: 'pot-odds', count: 6, passRate: 0.65 }, coach: 'full',
  },
  {
    id: 'value', title: 'Betting strong hands', pitch: 'Get paid when you have it.',
    intro: 'When you are likely ahead, betting makes worse hands pay. Checking strong hands often wins less.',
    focus: ['value-betting'], opponents: ['june', 'bo', 'otto'],
    goal: { metric: 'decisions', concept: 'value-betting', count: 4, passRate: 0.65 }, coach: 'light',
  },
];

export const FREE_PLAY: Lesson = {
  id: 'free-play', title: 'Free play', pitch: 'A full six-handed table. Coach only speaks up on your weak spots.',
  intro: 'Mixed opponents, full table. Use hints whenever you want them.',
  focus: [], opponents: ['mara', 'june', 'rex', 'otto', 'ines'], goal: { metric: 'hands', count: 20 }, coach: 'light',
};

export function lessonById(id: string): Lesson {
  return LESSONS.find((l) => l.id === id) ?? FREE_PLAY;
}

/** Suggested lesson to practise a concept. */
export function lessonForConcept(c: ConceptId): Lesson | undefined {
  return LESSONS.find((l) => l.focus[0] === c) ?? LESSONS.find((l) => l.focus.includes(c));
}
