import { useEffect, useRef, useState } from 'react';
import { Advice, Grade } from '../coach/advisor';
import { CoachLevel, Lesson } from '../coach/lessons';
import { Tip } from '../coach/triggers';
import { Feedback } from '../game/useGame';
import { IconBulb, IconChevron } from './Icons';

interface Props {
  lesson: Lesson;
  coachLevel: CoachLevel;
  onCoachLevel: (c: CoachLevel) => void;
  goalText: string;
  goalFraction: number;
  tip: Tip | null;
  onDismissTip: () => void;
  advice: Advice | null;
  hintLevel: number;
  onHint: (level: number) => void;
  feedback: Feedback | null;
  resultLines: string[];
  notice: string | null;
  intro: boolean;
  onDismissIntro: () => void;
}

const GRADE_LABEL: Record<Grade, string> = { solid: 'Solid', okay: 'Reasonable', costly: 'Costly' };
const LEVELS: { id: CoachLevel; label: string }[] = [
  { id: 'full', label: 'Guide me' }, { id: 'light', label: 'Weak spots' }, { id: 'off', label: 'Quiet' },
];

export function CoachPanel(p: Props) {
  const [open, setOpen] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => setShowNote(false), [p.feedback?.id]);
  // keep the newest message in view when content changes
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [p.tip?.id, p.resultLines.length]);

  const hints = p.advice ? [p.advice.nudge, p.advice.hint, p.advice.showMe] : [];
  const hintNames = ['Nudge', 'Hint', 'Show me'];
  const summary = p.tip?.title ?? (p.feedback ? `${GRADE_LABEL[p.feedback.grade]} decision` : p.lesson.title);

  return (
    <aside className={`coach ${open ? 'is-open' : 'is-collapsed'}`} aria-label="Coach">
      <header className="coach__head">
        <button className="coach__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="coach__mark" aria-hidden>K</span>
          <span className="coach__title">
            <span className="coach__lesson">{p.lesson.title}</span>
            <span className="coach__summary">{open ? p.goalText : summary}</span>
          </span>
          <IconChevron className="coach__chev" />
        </button>
        <div className="coach__goal" aria-hidden><span style={{ width: `${Math.min(100, p.goalFraction * 100)}%` }} /></div>
      </header>

      <div className="coach__body" ref={bodyRef}>
        {p.notice && <p className="coach__notice">{p.notice}</p>}

        {p.intro && (
          <section className="note note--intro">
            <p>{p.lesson.intro}</p>
            <button className="linkbtn" onClick={p.onDismissIntro}>Let's play</button>
          </section>
        )}

        {p.tip && (
          <section className="note note--tip" key={p.tip.id} aria-live="polite">
            <h3>{p.tip.title}</h3>
            <p>{p.tip.body}</p>
            <button className="linkbtn" onClick={p.onDismissTip}>Got it</button>
          </section>
        )}

        {p.resultLines.length > 0 && (
          <section className="note note--result" aria-live="polite">
            <h3>How the hand ended</h3>
            {p.resultLines.map((l, i) => <p key={i}>{l}</p>)}
          </section>
        )}

        {p.feedback && (
          <section className={`note note--grade grade--${p.feedback.grade}`} key={p.feedback.id}>
            <div className="grade__row">
              <span className="grade__badge">{GRADE_LABEL[p.feedback.grade]}</span>
              <span className="grade__label">your last decision</span>
              <button className="linkbtn" onClick={() => setShowNote((s) => !s)} aria-expanded={showNote}>
                {showNote ? 'Hide' : 'Why?'}
              </button>
            </div>
            {showNote && <p>{p.feedback.note}</p>}
          </section>
        )}

        {p.advice && (
          <section className="hints" data-coach="hints">
            <div className="hints__row">
              <IconBulb />
              <span className="hints__label">Stuck?</span>
              <div className="hints__steps" role="group" aria-label="Hints, each more revealing">
                {hintNames.map((name, i) => (
                  <button
                    key={name}
                    className={`hintbtn ${p.hintLevel > i ? 'is-used' : ''}`}
                    disabled={p.hintLevel < i}
                    onClick={() => p.onHint(Math.max(p.hintLevel, i + 1))}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {hints.slice(0, p.hintLevel).map((h, i) => (
              <p key={i} className={`hints__text hints__text--${i}`}>{h}</p>
            ))}
          </section>
        )}
      </div>

      <footer className="coach__foot">
        <div className="segmented" role="radiogroup" aria-label="How much the coach talks">
          {LEVELS.map((l) => (
            <button key={l.id} role="radio" aria-checked={p.coachLevel === l.id} className={p.coachLevel === l.id ? 'is-on' : ''} onClick={() => p.onCoachLevel(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </footer>
    </aside>
  );
}
