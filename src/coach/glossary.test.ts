import { describe, expect, it } from 'vitest';
import { GLOSSARY, splitTerms } from './glossary';

const ids = (text: string) => splitTerms(text).filter((p) => typeof p !== 'string').map((p) => (p as { id: string }).id);

describe('glossary term marking', () => {
  it('marks jargon in coach text', () => {
    expect(ids('You are on the button, so after the flop you act last.')).toEqual(['button', 'flop']);
  });

  it('prefers the longest match and marks each term once', () => {
    expect(ids('The small blind posts. Blinds start the pot. Pot odds matter; the pot grows.')).toEqual(['small-blind', 'blinds', 'pot', 'pot-odds']);
  });

  it('does not mark words inside other words or the phrase "your turn"', () => {
    expect(ids('Better hands; it is your turn; straightforwardly.')).toEqual([]);
    expect(ids('A card on the turn helps.')).toEqual(['turn']);
  });

  it('keeps the original text intact', () => {
    const text = 'Calling 20 to win 80 means you need 20%. Folding saves chips.';
    expect(splitTerms(text).map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe(text);
  });

  it('has a definition for every entry', () => {
    for (const g of GLOSSARY) expect(g.definition.length).toBeGreaterThan(20);
  });
});
