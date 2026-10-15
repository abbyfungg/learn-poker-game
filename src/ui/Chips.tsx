import { CSSProperties } from 'react';

const DENOMS = [
  { value: 1000, tone: 'gold' },
  { value: 500, tone: 'plum' },
  { value: 100, tone: 'ink' },
  { value: 25, tone: 'green' },
  { value: 5, tone: 'red' },
  { value: 1, tone: 'ivory' },
] as const;

/** Break an amount into chip denominations, capped for display. */
export function chipBreakdown(amount: number, max = 8): string[] {
  const out: string[] = [];
  let rest = amount;
  for (const d of DENOMS) {
    while (rest >= d.value && out.length < max) {
      out.push(d.tone);
      rest -= d.value;
    }
  }
  return out;
}

export function formatChips(n: number): string {
  return n.toLocaleString('en-US');
}

interface Props {
  amount: number;
  label?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A small stack of casino chips with the amount beside it. */
export function ChipStack({ amount, label = true, className = '', style }: Props) {
  if (amount <= 0) return null;
  // group into up to three columns by denomination for a natural look
  const chips = chipBreakdown(amount);
  const cols: string[][] = [];
  for (const tone of chips) {
    const col = cols.find((c) => c[0] === tone);
    if (col) col.push(tone);
    else if (cols.length < 3) cols.push([tone]);
    else cols[cols.length - 1].push(tone);
  }
  return (
    <div className={`chipstack ${className}`} style={style}>
      <div className="chipstack__cols" aria-hidden>
        {cols.map((col, i) => (
          <div className="chipstack__col" key={i}>
            {col.slice(0, 6).map((tone, j) => (
              <span key={j} className={`chip chip--${tone}`} style={{ '--n': j } as CSSProperties} />
            ))}
          </div>
        ))}
      </div>
      {label && <span className="chipstack__amount">{formatChips(amount)}</span>}
    </div>
  );
}
