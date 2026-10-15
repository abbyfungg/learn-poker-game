import { useEffect, useMemo, useState } from 'react';
import { cardCode } from './engine/cards';
import { positionOf, totalPot } from './engine/game';
import { handStrength } from './coach/handStrength';
import { narrate } from './coach/narrate';
import { CoachLevel, LESSONS, Lesson } from './coach/lessons';
import { loadProgress } from './coach/progress';
import { HERO_SEAT, useGame } from './game/useGame';
import { ActionBar } from './ui/ActionBar';
import { CoachPanel } from './ui/CoachPanel';
import { HandReplay } from './ui/HandReplay';
import { GuideTab, HandGuide } from './ui/HandGuide';
import { IconGuide, IconHistory, IconLessons, IconSpade } from './ui/Icons';
import { Lobby } from './ui/Lobby';
import { SessionReview } from './ui/SessionReview';
import { Table } from './ui/Table';

export default function App() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [session, setSession] = useState(0);
  const [lobbyOpen, setLobbyOpen] = useState(true);

  const pick = (l: Lesson) => {
    setLesson(l);
    setSession((s) => s + 1);
    setLobbyOpen(false);
  };

  return (
    <div className="app">
      {lesson && (
        <GameScreen key={session} lesson={lesson} onLessons={() => setLobbyOpen(true)} onPick={pick} />
      )}
      {!lesson && <div className="app__backdrop" aria-hidden />}
      {lobbyOpen && (
        <Lobby progress={loadProgress()} onPick={pick} onClose={lesson ? () => setLobbyOpen(false) : undefined} />
      )}
    </div>
  );
}

function GameScreen({ lesson, onLessons, onPick }: { lesson: Lesson; onLessons: () => void; onPick: (l: Lesson) => void }) {
  const [coachLevel, setCoachLevel] = useState<CoachLevel>(lesson.coach);
  const effective = useMemo(() => ({ ...lesson, coach: coachLevel }), [lesson, coachLevel]);
  // ?seed=123 makes the deck order reproducible (used by the browser tests)
  const [seed] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('seed');
    return v ? Number(v) : undefined;
  });
  const g = useGame(effective, seed);
  const [sessionStart] = useState(() => Date.now());
  const [intro, setIntro] = useState(true);
  const [replayId, setReplayId] = useState<string | null | undefined>(undefined);
  const [reviewSeen, setReviewSeen] = useState(false);

  const { game } = g;
  const hero = game.players[HERO_SEAT];
  const handOver = game.phase === 'complete';
  const suggested = g.advice && g.hintLevel >= 3 ? { choice: g.advice.best, amount: g.advice.amount } : null;
  const spotlight = g.hintLevel >= 3 ? 'actions' : g.tip?.target;
  const waitingFor = game.toAct !== null && game.toAct !== HERO_SEAT ? game.players[game.toAct].name : undefined;

  // how good is my hand right now? (only the player's own cards + the board)
  const heroKey = hero.hole.map(cardCode).join(' ');
  const opponentsIn = game.players.filter((p) => p.seat !== HERO_SEAT && !p.folded && !p.out).length;
  const heroStrength = useMemo(
    () => (hero.hole.length === 2 && !hero.folded
      ? handStrength(hero.hole, game.board, Math.max(1, opponentsIn), positionOf(game, HERO_SEAT))
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroKey, game.board.length, opponentsIn, hero.folded, game.handNumber],
  );
  const narration = useMemo(() => narrate(game, HERO_SEAT), [game]);
  const [guideTab, setGuideTab] = useState<GuideTab | null>(null);
  const openGuide = (tab: GuideTab = 'mine') => setGuideTab(tab);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'g' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement) return;
      setGuideTab((t) => (t ? null : 'mine'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goal = lesson.goal;
  const unit = goal.metric === 'hands' ? 'hands' : goal.metric === 'showdowns' ? 'showdowns seen' : 'decisions';
  const goalText = lesson.id === 'free-play'
    ? `Hand ${game.handNumber} · ${g.stats.net >= 0 ? '+' : ''}${g.stats.net} chips this session`
    : `${Math.min(g.goalProgress, goal.count)} of ${goal.count} ${unit}${goal.passRate && g.stats.decisions ? ` · ${Math.round(g.passRate * 100)}% reasonable` : ''}`;

  const sessionHands = g.history.filter((h) => h.lessonId === lesson.id && Number(h.id.split('-')[0]) >= sessionStart);
  const showReview = g.goalMet && !reviewSeen && lesson.id !== 'free-play' && replayId === undefined;
  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const nextLesson = idx >= 0 ? LESSONS[idx + 1] : undefined;

  return (
    <div className="room" data-spotlight={spotlight ?? ''}>
      <header className="topbar">
        <div className="brand"><IconSpade /> <span>Kicker</span></div>
        <nav className="topbar__nav">
          <button className="btn btn--ghost btn--sm" onClick={() => openGuide()} aria-label="Hand guide"><IconGuide /> <span className="btn__text">Hand guide</span></button>
          <button className="btn btn--ghost btn--sm" onClick={onLessons} aria-label="Lessons"><IconLessons /> <span className="btn__text">Lessons</span></button>
          <button className="btn btn--ghost btn--sm" onClick={() => setReplayId(null)} aria-label="Hand history"><IconHistory /> <span className="btn__text">Hand history</span></button>
        </nav>
      </header>

      <main className="room__main">
        <section className="room__table" aria-label="Poker table">
          <Table game={game} heroSeat={HERO_SEAT} bots={g.bots} sweeping={g.sweeping} heroStrength={heroStrength} onOpenGuide={() => openGuide()} />
          <ActionBar
            legal={g.heroView?.legal ?? null}
            pot={totalPot(game)}
            currentBet={game.currentBet}
            myBet={hero.bet}
            bigBlind={game.bigBlind}
            preflop={game.phase === 'preflop'}
            suggested={suggested}
            onAct={g.act}
            handOver={handOver}
            onNext={g.nextHand}
            waitingFor={waitingFor}
          />
        </section>

        <CoachPanel
          lesson={lesson}
          coachLevel={coachLevel}
          onCoachLevel={setCoachLevel}
          goalText={goalText}
          goalFraction={lesson.id === 'free-play' ? 0 : g.goalProgress / goal.count}
          tip={g.tip}
          onDismissTip={() => g.setTip(null)}
          advice={g.advice}
          hintLevel={g.hintLevel}
          onHint={g.setHintLevel}
          feedback={g.feedback}
          resultLines={g.resultLines}
          notice={g.notice}
          intro={intro && game.handNumber <= 1}
          onDismissIntro={() => setIntro(false)}
          narration={narration}
          onOpenGuide={() => openGuide()}
        />
      </main>

      {guideTab && (
        <HandGuide
          tab={guideTab}
          onTab={setGuideTab}
          strength={heroStrength}
          heroCards={heroStrength ? heroKey : null}
          onClose={() => setGuideTab(null)}
        />
      )}
      {replayId !== undefined && (
        <HandReplay hands={g.history} initialId={replayId ?? undefined} onClose={() => setReplayId(undefined)} />
      )}
      {showReview && (
        <SessionReview
          lesson={lesson}
          passed={g.passed}
          passRate={g.passRate}
          stats={g.stats}
          hands={sessionHands}
          progress={g.progress}
          nextLesson={nextLesson}
          onNext={() => nextLesson && onPick(nextLesson)}
          onKeepPlaying={() => setReviewSeen(true)}
          onReplay={(id) => setReplayId(id)}
          onLessons={() => { setReviewSeen(true); onLessons(); }}
        />
      )}
    </div>
  );
}
