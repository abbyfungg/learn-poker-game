import { CONCEPTS, ConceptId } from '../coach/concepts';
import { HandRecord } from '../coach/history';
import { Lesson } from '../coach/lessons';
import { MASTERY_LABELS, Progress, mastery } from '../coach/progress';
import { LessonStats } from '../game/useGame';
import { formatChips } from './Chips';

interface Props {
  lesson: Lesson;
  passed: boolean;
  passRate: number;
  stats: LessonStats;
  hands: HandRecord[];
  progress: Progress;
  nextLesson?: Lesson;
  onNext: () => void;
  onKeepPlaying: () => void;
  onReplay: (id: string) => void;
  onLessons: () => void;
}

export function SessionReview({ lesson, passed, passRate, stats, hands, progress, nextLesson, onNext, onKeepPlaying, onReplay, onLessons }: Props) {
  const decisions = hands.flatMap((h) => h.decisions.map((d) => ({ ...d, hand: h })));
  const counts = { solid: 0, okay: 0, costly: 0 };
  decisions.forEach((d) => counts[d.grade]++);
  const touched = [...new Set(decisions.flatMap((d) => d.concepts))] as ConceptId[];
  const notable = [
    ...hands.filter((h) => h.decisions.some((d) => d.grade === 'costly')).slice(-3),
    ...hands.slice().sort((a, b) => b.heroNet - a.heroNet).slice(0, 1),
  ].filter((h, i, arr) => arr.findIndex((x) => x.id === h.id) === i);

  return (
    <div className="drawer drawer--center" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="drawer__panel review">
        <h2 id="review-title">{passed ? `${lesson.title}: complete` : `${lesson.title}: keep practising`}</h2>
        <p className="review__lede">
          {passed
            ? 'Nice work. Here is how the session went.'
            : `You made reasonable decisions ${Math.round(passRate * 100)}% of the time; this lesson asks for ${Math.round((lesson.goal.passRate ?? 0) * 100)}%. A few more hands will do it.`}
        </p>
        <dl className="review__stats">
          <div><dt>Hands</dt><dd>{stats.hands}</dd></div>
          <div><dt>Chips</dt><dd className={stats.net >= 0 ? 'is-up' : 'is-down'}>{stats.net >= 0 ? '+' : ''}{formatChips(stats.net)}</dd></div>
          <div><dt>Solid</dt><dd>{counts.solid}</dd></div>
          <div><dt>Reasonable</dt><dd>{counts.okay}</dd></div>
          <div><dt>Costly</dt><dd>{counts.costly}</dd></div>
        </dl>
        <p className="review__aside">Chips won or lost swing a lot over a few hands. The decision count is the better measure of how you're doing.</p>

        {touched.length > 0 && (
          <>
            <h3>Concepts you practised</h3>
            <ul className="review__concepts">
              {touched.map((id) => (
                <li key={id}><span>{CONCEPTS[id].title}</span><span className={`concept__level concept--${mastery(progress.concepts[id])}`}>{MASTERY_LABELS[mastery(progress.concepts[id])]}</span></li>
              ))}
            </ul>
          </>
        )}

        {notable.length > 0 && (
          <>
            <h3>Hands worth a replay</h3>
            <ul className="review__hands">
              {notable.map((h) => (
                <li key={h.id}>
                  <button className="linkbtn" onClick={() => onReplay(h.id)}>
                    Hand {h.handNumber}: {h.heroNet >= 0 ? `won ${formatChips(h.heroNet)}` : `lost ${formatChips(-h.heroNet)}`}
                    {h.decisions.some((d) => d.grade === 'costly') ? ' — one decision to look at' : ''}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="review__actions">
          {passed && nextLesson && <button className="btn btn--primary" onClick={onNext}>Next: {nextLesson.title}</button>}
          <button className={`btn ${passed && nextLesson ? 'btn--ghost' : 'btn--primary'}`} onClick={onKeepPlaying}>Keep playing</button>
          <button className="btn btn--ghost" onClick={onLessons}>All lessons</button>
        </div>
      </div>
    </div>
  );
}
