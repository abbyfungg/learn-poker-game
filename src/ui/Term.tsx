import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TextPart, glossaryEntry, splitTerms } from '../coach/glossary';

interface TermProps {
  id: string;
  children: ReactNode;
}

/** A jargon word with a plain-English explanation on hover, focus, or tap. */
export function Term({ id, children }: TermProps) {
  const entry = glossaryEntry(id);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 140;
    setPos({ x: Math.min(window.innerWidth - 140, Math.max(140, r.left + r.width / 2)), y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      hide();
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [pos]);

  if (!entry) return <>{children}</>;
  return (
    <>
      <span
        ref={ref}
        className="term"
        tabIndex={0}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.stopPropagation(); if (pos) hide(); else show(); }}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          id={tipId}
          role="tooltip"
          className={`termtip ${pos.below ? 'is-below' : ''}`}
          style={{ left: pos.x, top: pos.y }}
        >
          <strong>{entry.term}</strong>
          <span>{entry.definition}</span>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Render text with glossary terms marked (first appearance of each term only). */
export function RichText({ text, marked }: { text: string; marked?: Set<string> }) {
  const parts: TextPart[] = splitTerms(text, marked);
  return (
    <>
      {parts.map((p, i) => (typeof p === 'string' ? p : <Term key={i} id={p.id}>{p.text}</Term>))}
    </>
  );
}
