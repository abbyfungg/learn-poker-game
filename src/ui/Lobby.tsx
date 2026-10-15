import { CONCEPTS, CONCEPT_ORDER } from '../coach/concepts';
import { FREE_PLAY, LESSONS, Lesson, lessonForConcept } from '../coach/lessons';
import { MASTERY_LABELS, Progress, mastery, weakSpots } from '../coach/progress';
import { IconSpade } from './Icons';

interface Props {
  progress: Progress;
  onPick: (l: Lesson) => void;
  onClose?: () => void;
}

export function Lobby({ progress, onPick, onClose }: Props) {
  const nextLesson = LESSONS.find((l) => !progress.lessonsDone.includes(l.id));
  const weak = weakSpots(progress)[0];
  const weakLesson = weak ? lessonForConcept(weak) : undefined;
  return (
    <div className="lobby" role="dialog" aria-modal="true" aria-labelledby="lobby-title">
      <div className="lobby__inner">
        <header className="lobby__head">
          <div className="brand brand--large"><IconSpade /> <span>Kicker</span></div>
          <h1 id="lobby-title">Learn Hold'em by playing it.</h1>
          <p className="lobby__lede">Short lessons at a real table against opponents with their own styles. Ask for help when you want it; otherwise the coach stays out of the way.</p>
          {onClose && <button className="btn btn--ghost lobby__close" onClick={onClose}>Back to the table</button>}
        </header>

        <div className="lobby__cols">
          <section className="lobby__lessons" aria-label="Lessons">
            <h2>Lessons</h2>
            <ol className="lessonlist">
              {LESSONS.map((l, i) => {
                const done = progress.lessonsDone.includes(l.id);
                const next = nextLesson?.id === l.id;
                return (
                  <li key={l.id}>
                    <button className={`lesson ${done ? 'is-done' : ''} ${next ? 'is-next' : ''}`} onClick={() => onPick(l)}>
                      <span className="lesson__num" aria-hidden>{done ? '✓' : i + 1}</span>
                      <span className="lesson__text">
                        <span className="lesson__title">{l.title}{next && <span className="lesson__tag">Up next</span>}</span>
                        <span className="lesson__pitch">{l.pitch}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button className="lesson lesson--free" onClick={() => onPick(FREE_PLAY)}>
              <span className="lesson__num" aria-hidden>∞</span>
              <span className="lesson__text">
                <span className="lesson__title">{FREE_PLAY.title}</span>
                <span className="lesson__pitch">{FREE_PLAY.pitch}</span>
              </span>
            </button>
          </section>

          <section className="lobby__progress" aria-label="Your progress">
            <h2>What you know</h2>
            {weak && weakLesson && (
              <button className="weakspot" onClick={() => onPick(weakLesson)}>
                <span>Worth another look: <strong>{CONCEPTS[weak].title.toLowerCase()}</strong></span>
                <span className="weakspot__go">Practise in “{weakLesson.title}”</span>
              </button>
            )}
            <ul className="conceptlist">
              {CONCEPT_ORDER.map((id) => {
                const c = progress.concepts[id];
                const m = mastery(c);
                const introduced = c.seen > 0 || progress.seenTips.some((t) => t.includes(id.split('-')[0]));
                return (
                  <li key={id} className={`concept concept--${m}`}>
                    <div className="concept__row">
                      <span className="concept__title">{CONCEPTS[id].title}</span>
                      <span className="concept__level">{c.seen === 0 ? (introduced ? 'Introduced' : 'Not yet') : MASTERY_LABELS[m]}</span>
                    </div>
                    <div className="concept__bar" aria-hidden><span style={{ width: `${c.seen ? Math.round(c.score * 100) : 0}%` }} /></div>
                    <p className="concept__summary">{CONCEPTS[id].summary}{c.seen > 0 && ` ${c.seen} decision${c.seen === 1 ? '' : 's'} so far.`}</p>
                  </li>
                );
              })}
            </ul>
            <p className="lobby__foot">{progress.handsPlayed} hands played. Progress is saved in this browser.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
