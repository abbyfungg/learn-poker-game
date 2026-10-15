import { useEffect, useState } from 'react';
import { HandRecord } from '../coach/history';
import { PlayingCard } from './Card';
import { formatChips } from './Chips';
import { IconChevron, IconClose, IconPrev } from './Icons';

const STREET_CARDS: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
const GRADE_LABEL = { solid: 'Solid', okay: 'Reasonable', costly: 'Costly' } as const;

function verb(kind: string, added: number, betTo: number, allIn: boolean) {
  const tail = allIn ? ' (all-in)' : '';
  switch (kind) {
    case 'post-sb': return `posts small blind ${added}`;
    case 'post-bb': return `posts big blind ${added}`;
    case 'fold': return 'folds';
    case 'check': return 'checks';
    case 'call': return `calls ${formatChips(added)}${tail}`;
    case 'bet': return `bets ${formatChips(betTo)}${tail}`;
    case 'raise': return `raises to ${formatChips(betTo)}${tail}`;
    default: return kind;
  }
}

interface Props {
  hands: HandRecord[];
  initialId?: string;
  onClose: () => void;
}

/** Hand history list plus a step-through replay of one hand. */
export function HandReplay({ hands, initialId, onClose }: Props) {
  const ordered = hands.slice().reverse();
  const [id, setId] = useState(initialId ?? ordered[0]?.id);
  const hand = ordered.find((h) => h.id === id);
  const [step, setStep] = useState(0);
  useEffect(() => setStep(hand ? hand.actions.length - 1 : 0), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hand) return;
      if (e.key === 'ArrowRight') setStep((s) => Math.min(hand.actions.length - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hand, onClose]);

  const name = (seat: number) => (hand && seat === hand.heroSeat ? 'You' : hand?.players[seat].name ?? '');
  const cur = hand?.actions[step];
  const atEnd = hand ? step === hand.actions.length - 1 : false;
  const boardCount = cur ? (atEnd ? hand!.board.length : STREET_CARDS[cur.street]) : 0;
  const decisionAt = (i: number) => hand?.decisions.find((d) => d.logIndex === i);

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="replay-title">
      <div className="drawer__panel drawer__panel--wide">
        <header className="drawer__head">
          <h2 id="replay-title">Hand history</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>
        {ordered.length === 0 ? (
          <p className="drawer__empty">Hands you play will appear here, with your decisions and the coach's notes.</p>
        ) : (
          <div className="replay">
            <ul className="replay__list">
              {ordered.map((h) => {
                const hero = h.players[h.heroSeat];
                const costly = h.decisions.some((d) => d.grade === 'costly');
                return (
                  <li key={h.id}>
                    <button className={`handrow ${h.id === id ? 'is-on' : ''}`} onClick={() => setId(h.id)}>
                      <span className="handrow__cards">
                        {hero.hole?.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
                      </span>
                      <span className="handrow__meta">
                        <span>Hand {h.handNumber}</span>
                        <span className={`handrow__net ${h.heroNet > 0 ? 'is-up' : h.heroNet < 0 ? 'is-down' : ''}`}>
                          {h.heroNet > 0 ? '+' : ''}{formatChips(h.heroNet)}
                        </span>
                      </span>
                      {costly && <span className="handrow__flag" title="Contains a costly decision">Review</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            {hand && cur && (
              <div className="replay__stage">
                <div className="replay__table">
                  <div className="replay__board">
                    {[0, 1, 2, 3, 4].map((i) => (i < boardCount ? <PlayingCard key={i} card={hand.board[i]} size="md" /> : <div key={i} className="board__slot board__slot--sm" />))}
                  </div>
                  <div className="replay__seats">
                    {hand.players.filter((p) => !p.out).map((p) => (
                      <div key={p.seat} className={`replay__seat ${cur.seat === p.seat ? 'is-on' : ''}`}>
                        <span className="replay__name">{name(p.seat)}{p.seat === hand.button && <span className="replay__btn">D</span>}</span>
                        <span className="replay__cards">
                          {p.hole && (p.seat === hand.heroSeat || atEnd)
                            ? p.hole.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
                            : <span className="replay__hidden">{p.hole ? 'Hidden until showdown' : 'Not shown'}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="replay__controls">
                  <button className="iconbtn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} aria-label="Previous action"><IconPrev /></button>
                  <span className="replay__step">{step + 1} / {hand.actions.length}</span>
                  <button className="iconbtn" onClick={() => setStep((s) => Math.min(hand.actions.length - 1, s + 1))} disabled={atEnd} aria-label="Next action"><IconChevron /></button>
                </div>

                <ol className="replay__log">
                  {hand.actions.map((a, i) => {
                    const d = decisionAt(i);
                    return (
                      <li key={i} className={`${i === step ? 'is-on' : ''} ${i > step ? 'is-future' : ''}`}>
                        <button className="replay__entry" onClick={() => setStep(i)}>
                          <span className="replay__street">{i === 0 || hand.actions[i - 1].street !== a.street ? a.street : ''}</span>
                          <span><strong>{name(a.seat)}</strong> {verb(a.kind, a.added, a.betTo, a.allIn)}</span>
                          {d && <span className={`grade__badge grade--${d.grade}`}>{GRADE_LABEL[d.grade]}</span>}
                        </button>
                        {i === step && d && <p className="replay__note">{d.note}{d.hintLevel > 0 ? ' (You used a hint here.)' : ''}</p>}
                        {i === step && a.reason && <p className="replay__note replay__note--bot">{a.reason}</p>}
                      </li>
                    );
                  })}
                </ol>
                {atEnd && hand.summary.length > 0 && (
                  <div className="replay__summary">{hand.summary.map((l, i) => <p key={i}>{l}</p>)}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
