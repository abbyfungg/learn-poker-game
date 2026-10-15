import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rng, createRng } from '../engine/cards';
import { HandCategory, evaluateBest } from '../engine/evaluator';
import {
  Action, GameState, SeatConfig, advanceStreet, applyAction, createTable, isRoundOver, startHand, viewFor,
} from '../engine/game';
import { BOTS, BotProfile, decide } from '../ai/bot';
import { Advice, GradedDecision, advise, gradeDecision } from '../coach/advisor';
import { HandRecord, HeroDecision, buildRecord, loadHistory, saveHistory } from '../coach/history';
import { Lesson } from '../coach/lessons';
import { Progress, loadProgress, markTip, recordDecision, saveProgress } from '../coach/progress';
import { Tip, explainResult, teachingMoment } from '../coach/triggers';

export const HERO_SEAT = 0;
const START_STACK = 2000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

export interface LessonStats {
  hands: number;
  showdowns: number;
  decisions: number;
  goodDecisions: number;
  net: number;
}

export interface Feedback extends GradedDecision {
  id: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function seatsFor(lesson: Lesson): { seats: SeatConfig[]; bots: Record<number, BotProfile> } {
  const bots: Record<number, BotProfile> = {};
  const seats: SeatConfig[] = [{ id: 'hero', name: 'You', stack: START_STACK, isHero: true }];
  lesson.opponents.forEach((id, i) => {
    const bot = BOTS.find((b) => b.id === id)!;
    bots[i + 1] = bot;
    seats.push({ id: bot.id, name: bot.name, stack: START_STACK });
  });
  return { seats, bots };
}

export function useGame(lesson: Lesson, seed?: number) {
  const rngRef = useRef<Rng>(createRng(seed ?? (Date.now() >>> 0)));
  const { seats, bots } = useMemo(() => seatsFor(lesson), [lesson]);
  const [game, setGame] = useState<GameState>(() => startHand(createTable(seats, SMALL_BLIND, BIG_BLIND), rngRef.current));
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [history, setHistory] = useState<HandRecord[]>(loadHistory);
  const [sweeping, setSweeping] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resultLines, setResultLines] = useState<string[]>([]);
  const [stats, setStats] = useState<LessonStats>({ hands: 0, showdowns: 0, decisions: 0, goodDecisions: 0, net: 0 });
  const [notice, setNotice] = useState<string | null>(null);

  // per-hand bookkeeping (refs: not rendered directly)
  const startStacks = useRef<number[]>(game.players.map((p) => p.stack + p.committed));
  const reasons = useRef<Record<number, string>>({});
  const decisions = useRef<HeroDecision[]>([]);
  const shownThisHand = useRef<string[]>([]);
  const prevCategory = useRef<HandCategory | null>(null);
  const recordedHand = useRef<number>(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const fast = prefersReducedMotion();
  const heroTurn = game.toAct === HERO_SEAT && !sweeping;
  const heroView = useMemo(() => (heroTurn ? viewFor(game, HERO_SEAT) : null), [game, heroTurn]);
  const advice: Advice | null = useMemo(() => (heroView ? advise(heroView) : null), [heroView]);

  // teaching moment when the hero's decision point begins
  const lastDecisionKey = useRef('');
  useEffect(() => {
    if (!heroView || !advice) return;
    // once per decision point (effects can re-run, e.g. React StrictMode in development)
    const key = `${game.handNumber}:${heroView.log.length}`;
    if (lastDecisionKey.current === key) return;
    lastDecisionKey.current = key;
    setHintLevel(0);
    const t = teachingMoment({
      view: heroView, advice, progress: progressRef.current, coach: lesson.coach, focus: lesson.focus,
      prevCategory: prevCategory.current, shownThisHand: shownThisHand.current,
    });
    if (heroView.board.length >= 3) {
      prevCategory.current = evaluateBest([...heroView.hole, ...heroView.board]).category;
    }
    if (t) {
      shownThisHand.current.push(t.id);
      if (t.once) setProgress((p) => { const n = markTip(p, t.id); saveProgress(n); return n; });
      setTip(t);
    }
  }, [heroView, advice, lesson, game.handNumber]);

  // drive bots and street transitions
  useEffect(() => {
    if (game.phase === 'complete') return;
    if (isRoundOver(game)) {
      const hasBets = game.players.some((p) => p.bet > 0);
      setSweeping(hasBets);
      const runout = game.players.filter((p) => !p.folded && !p.out && !p.allIn).length < 2;
      const t = setTimeout(() => {
        setSweeping(false);
        setGame((g) => (isRoundOver(g) ? advanceStreet(g) : g));
      }, fast ? 150 : runout ? 900 : hasBets ? 480 : 260);
      return () => clearTimeout(t);
    }
    const seat = game.toAct;
    if (seat === null || seat === HERO_SEAT) return;
    const bot = bots[seat];
    const t = setTimeout(() => {
      setGame((g) => {
        if (g.toAct !== seat) return g;
        const d = decide(viewFor(g, seat), bot, rngRef.current);
        reasons.current[g.log.length] = d.reason;
        return applyAction(g, d.action);
      });
    }, fast ? 250 : 650 + Math.floor(rngRef.current() * 450));
    return () => clearTimeout(t);
  }, [game, bots, fast]);

  // hand finished: explain, record, update stats
  useEffect(() => {
    if (game.phase !== 'complete' || recordedHand.current === game.handNumber) return;
    recordedHand.current = game.handNumber;
    const lines = explainResult(game, HERO_SEAT, decisions.current);
    setResultLines(lines);
    const record = buildRecord(game, lesson.id, HERO_SEAT, startStacks.current, reasons.current, decisions.current, lines);
    setHistory((h) => { const n = [...h, record].slice(-40); saveHistory(n); return n; });
    setStats((s) => ({
      ...s,
      hands: s.hands + 1,
      showdowns: s.showdowns + (game.result && !game.result.uncontested ? 1 : 0),
      net: s.net + record.heroNet,
    }));
    setProgress((p) => { const n = { ...p, handsPlayed: p.handsPlayed + 1 }; saveProgress(n); return n; });
  }, [game, lesson.id]);

  const act = useCallback((action: Action) => {
    if (!advice || game.toAct !== HERO_SEAT) return;
    const graded = gradeDecision(advice, action.type);
    const counted = advice.concepts;
    decisions.current.push({
      logIndex: game.log.length, street: game.phase as HeroDecision['street'], grade: graded.grade, note: graded.note,
      hintLevel, concepts: counted,
    });
    setFeedback({ ...graded, id: Date.now() });
    setProgress((p) => { const n = recordDecision(p, counted, graded.grade, hintLevel); saveProgress(n); return n; });
    setStats((s) => {
      const focus = lesson.goal.concept;
      if (lesson.goal.metric !== 'decisions' || (focus && !counted.includes(focus))) return s;
      return { ...s, decisions: s.decisions + 1, goodDecisions: s.goodDecisions + (graded.grade === 'costly' ? 0 : 1) };
    });
    setTip(null);
    setHintLevel(0);
    setGame((g) => applyAction(g, action));
  }, [advice, game, hintLevel, lesson.goal]);

  const nextHand = useCallback(() => {
    setGame((g) => {
      if (g.phase !== 'complete') return g;
      const rebuys: string[] = [];
      const players = g.players.map((p) => {
        if (p.stack > 0) return p;
        rebuys.push(p.isHero ? 'You' : p.name);
        return { ...p, stack: START_STACK };
      });
      setNotice(rebuys.length ? `${rebuys.join(' and ')} ${rebuys.length === 1 && rebuys[0] !== 'You' ? 'rebuys' : 'rebuy'} for ${START_STACK}.` : null);
      const next = startHand({ ...g, players }, rngRef.current);
      startStacks.current = next.players.map((p) => p.stack + p.committed);
      return next;
    });
    reasons.current = {};
    decisions.current = [];
    shownThisHand.current = [];
    prevCategory.current = null;
    setResultLines([]);
    setFeedback(null);
    setTip(null);
  }, []);

  const goal = lesson.goal;
  const goalProgress = goal.metric === 'hands' ? stats.hands : goal.metric === 'showdowns' ? stats.showdowns : stats.decisions;
  const goalMet = goalProgress >= goal.count && game.phase === 'complete';
  const passRate = stats.decisions ? stats.goodDecisions / stats.decisions : 1;
  const passed = goalMet && (!goal.passRate || passRate >= goal.passRate);

  useEffect(() => {
    if (passed && !progress.lessonsDone.includes(lesson.id) && lesson.id !== 'free-play') {
      setProgress((p) => { const n = { ...p, lessonsDone: [...p.lessonsDone, lesson.id] }; saveProgress(n); return n; });
    }
  }, [passed, lesson.id, progress.lessonsDone]);

  return {
    game, bots, heroView, advice, tip, setTip, hintLevel, setHintLevel, feedback, resultLines, sweeping,
    act, nextHand, stats, progress, history, goalProgress, goalMet, passed, passRate, notice,
    handDecisions: decisions.current,
  };
}

export type GameController = ReturnType<typeof useGame>;
