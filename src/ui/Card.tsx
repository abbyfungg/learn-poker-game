import { CSSProperties } from 'react';
import { Card as CardT, SUIT_SYMBOLS, cardName, rankLabel } from '../engine/cards';

interface Props {
  card?: CardT | null;
  /** Show the back instead of the face. */
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Animation: 'deal' slides in from the table centre, 'flip' turns over. */
  enter?: 'deal' | 'flip' | null;
  /** Stagger index for entrance animations. */
  delay?: number;
  highlight?: boolean;
  dim?: boolean;
  style?: CSSProperties;
}

export function PlayingCard({ card, faceDown, size = 'md', enter, delay = 0, highlight, dim, style }: Props) {
  const cls = ['pcard', `pcard--${size}`, enter ? `pcard--${enter}` : '', highlight ? 'is-highlight' : '', dim ? 'is-dim' : '']
    .filter(Boolean)
    .join(' ');
  const vars = { ...style, '--i': delay } as CSSProperties;
  if (faceDown || !card) {
    return (
      <div className={`${cls} pcard--back`} style={vars} aria-label="Face-down card" role="img">
        <div className="pcard__back-inner" />
      </div>
    );
  }
  const red = card.suit === 'h' || card.suit === 'd';
  const sym = SUIT_SYMBOLS[card.suit];
  const rank = rankLabel(card.rank);
  return (
    <div className={`${cls} ${red ? 'is-red' : 'is-black'} suit-${card.suit}`} style={vars} role="img" aria-label={cardName(card)}>
      <span className="pcard__index pcard__index--tl" aria-hidden>
        <b>{rank}</b>
        <i>{sym}</i>
      </span>
      <span className="pcard__pip" aria-hidden>{card.rank > 10 && card.rank < 14 ? <em>{rank}</em> : sym}</span>
      <span className="pcard__index pcard__index--br" aria-hidden>
        <b>{rank}</b>
        <i>{sym}</i>
      </span>
    </div>
  );
}
