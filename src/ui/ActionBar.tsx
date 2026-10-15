import { CSSProperties, useEffect, useState } from 'react';
import { Action, LegalActions } from '../engine/game';
import { Choice } from '../coach/advisor';
import { formatChips } from './Chips';

interface Props {
  legal: LegalActions | null;
  pot: number;
  currentBet: number;
  myBet: number;
  bigBlind: number;
  preflop: boolean;
  /** Highlight this choice (from "Show me"). */
  suggested?: { choice: Choice; amount?: number } | null;
  onAct: (a: Action) => void;
  handOver: boolean;
  onNext: () => void;
  waitingFor?: string;
}

export function ActionBar({ legal, pot, currentBet, myBet, bigBlind, preflop, suggested, onAct, handOver, onNext, waitingFor }: Props) {
  const aggressive = legal?.canBet ? 'bet' : 'raise';
  const canAggress = !!legal && (legal.canBet || legal.canRaise);
  const [amount, setAmount] = useState(0);

  // reset the sizer when a new decision starts
  useEffect(() => {
    if (!legal) return;
    const def = suggested?.amount ?? defaultSize(legal, pot, currentBet, bigBlind, preflop);
    setAmount(clamp(def, legal.minTo, legal.maxTo));
  }, [legal?.seat, legal?.minTo, legal?.maxTo, pot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (suggested?.amount && legal) setAmount(clamp(suggested.amount, legal.minTo, legal.maxTo));
  }, [suggested?.amount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === 'number') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (handOver && (k === 'n' || k === 'enter') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); onNext(); return; }
      if (!legal) return;
      if (k === 'f' && legal.canFold) onAct({ type: 'fold' });
      else if (k === 'c') onAct(legal.canCheck ? { type: 'check' } : { type: 'call' });
      else if (k === 'r' && canAggress) onAct({ type: aggressive, amount });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [legal, amount, canAggress, aggressive, onAct, handOver, onNext]);

  if (handOver) {
    return (
      <div className="actionbar actionbar--next">
        <button className="btn btn--primary btn--wide" onClick={onNext} autoFocus>
          Deal next hand <kbd>N</kbd>
        </button>
      </div>
    );
  }

  if (!legal) {
    return (
      <div className="actionbar actionbar--waiting" aria-live="polite">
        <span className="actionbar__waiting">{waitingFor ? `${waitingFor} is deciding…` : 'Dealing…'}</span>
      </div>
    );
  }

  const presets = sizePresets(legal, pot, currentBet, bigBlind, preflop);
  const isSuggested = (c: Choice) => suggested?.choice === c || (suggested && (c === 'bet' || c === 'raise') && (suggested.choice === 'bet' || suggested.choice === 'raise'));
  const allIn = amount >= legal.maxTo;
  const step = Math.max(1, bigBlind / 2);

  return (
    <div className="actionbar" data-coach="actions">
      <div className="actionbar__buttons">
        {legal.canFold ? (
          <button className={`btn btn--fold ${isSuggested('fold') ? 'is-suggested' : ''}`} onClick={() => onAct({ type: 'fold' })}>
            Fold <kbd>F</kbd>
          </button>
        ) : (
          <button className="btn btn--fold" disabled title="Nothing to fold to — you can check for free">Fold</button>
        )}
        {legal.canCheck ? (
          <button className={`btn btn--call ${isSuggested('check') ? 'is-suggested' : ''}`} onClick={() => onAct({ type: 'check' })}>
            Check <kbd>C</kbd>
          </button>
        ) : (
          <button className={`btn btn--call ${isSuggested('call') ? 'is-suggested' : ''}`} onClick={() => onAct({ type: 'call' })}>
            Call {formatChips(legal.callAmount)}{legal.callAmount >= legal.maxTo - myBet ? ' (all-in)' : ''} <kbd>C</kbd>
          </button>
        )}
        <button
          className={`btn btn--raise ${isSuggested(aggressive) ? 'is-suggested' : ''}`}
          disabled={!canAggress}
          onClick={() => onAct({ type: aggressive, amount })}
        >
          {allIn ? `All-in ${formatChips(amount)}` : aggressive === 'bet' ? `Bet ${formatChips(amount)}` : `Raise to ${formatChips(amount)}`} <kbd>R</kbd>
        </button>
      </div>

      {canAggress && (
        <div className="sizer" data-coach="bet-sizer">
          <div className="sizer__presets" role="group" aria-label="Bet size presets">
            {presets.map((p) => (
              <button key={p.label} className={`chipbtn ${amount === p.value ? 'is-on' : ''}`} onClick={() => setAmount(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <input
            className="sizer__range"
            type="range"
            min={legal.minTo}
            max={legal.maxTo}
            step={step}
            value={amount}
            onChange={(e) => setAmount(clamp(Number(e.target.value), legal.minTo, legal.maxTo))}
            aria-label={aggressive === 'bet' ? 'Bet amount' : 'Raise to amount'}
            style={{ '--fill': `${((amount - legal.minTo) / Math.max(1, legal.maxTo - legal.minTo)) * 100}%` } as CSSProperties}
          />
          <input
            className="sizer__input"
            type="number"
            min={legal.minTo}
            max={legal.maxTo}
            step={step}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            onBlur={() => setAmount((a) => clamp(a, legal.minTo, legal.maxTo))}
            aria-label="Exact amount"
          />
        </div>
      )}
    </div>
  );
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(x)));
}

function defaultSize(l: LegalActions, pot: number, currentBet: number, bb: number, preflop: boolean) {
  const unit = bb / 2;
  const r = (x: number) => Math.round(x / unit) * unit;
  if (preflop) return currentBet <= bb ? bb * 3 : currentBet * 3;
  return l.canBet ? r(pot * 0.66) : r(currentBet + (pot + l.toCall) * 0.75);
}

function sizePresets(l: LegalActions, pot: number, currentBet: number, bb: number, preflop: boolean) {
  const round = (x: number) => clamp(Math.round(x / (bb / 2)) * (bb / 2), l.minTo, l.maxTo);
  let list: { label: string; value: number }[];
  if (preflop) {
    list = currentBet <= bb
      ? [{ label: '2.5×', value: round(bb * 2.5) }, { label: '3×', value: round(bb * 3) }, { label: '4×', value: round(bb * 4) }]
      : [{ label: '2.5×', value: round(currentBet * 2.5) }, { label: '3×', value: round(currentBet * 3) }, { label: '4×', value: round(currentBet * 4) }];
  } else if (l.canBet) {
    list = [{ label: '⅓ pot', value: round(pot / 3) }, { label: '½ pot', value: round(pot / 2) }, { label: '¾ pot', value: round(pot * 0.75) }, { label: 'Pot', value: round(pot) }];
  } else {
    const after = pot + l.toCall;
    list = [{ label: '½ pot', value: round(currentBet + after / 2) }, { label: '¾ pot', value: round(currentBet + after * 0.75) }, { label: 'Pot', value: round(currentBet + after) }];
  }
  list.push({ label: 'All-in', value: l.maxTo });
  // drop duplicates (short stacks)
  return list.filter((p, i) => list.findIndex((q) => q.value === p.value) === i);
}
