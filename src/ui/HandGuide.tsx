import { useEffect } from 'react';
import { parseCards } from '../engine/cards';
import { HandCategory } from '../engine/evaluator';
import { GLOSSARY, GlossaryEntry } from '../coach/glossary';
import { HandStrength, StrengthLevel } from '../coach/handStrength';
import { PlayingCard } from './Card';
import { IconClose } from './Icons';
import { RichText } from './Term';

export type GuideTab = 'mine' | 'rankings' | 'starting' | 'words';

const RANKINGS: { category: HandCategory; name: string; cards: string; what: string }[] = [
  { category: HandCategory.StraightFlush, name: 'Straight flush', cards: '9s 8s 7s 6s 5s', what: 'Five in a row, all the same suit. The best possible hand (A-K-Q-J-10 suited is a royal flush).' },
  { category: HandCategory.Quads, name: 'Four of a kind', cards: 'Qh Qd Qc Qs 4d', what: 'All four cards of one rank.' },
  { category: HandCategory.FullHouse, name: 'Full house', cards: 'Jh Jd Jc 7s 7d', what: 'Three of one rank plus a pair of another.' },
  { category: HandCategory.Flush, name: 'Flush', cards: 'Ah Jh 8h 5h 2h', what: 'Any five cards of the same suit, not in a row.' },
  { category: HandCategory.Straight, name: 'Straight', cards: 'Td 9c 8h 7s 6d', what: 'Five ranks in a row, mixed suits. Ace can be high (10-J-Q-K-A) or low (A-2-3-4-5).' },
  { category: HandCategory.Trips, name: 'Three of a kind', cards: '8c 8d 8h Ks 3d', what: 'Three cards of one rank.' },
  { category: HandCategory.TwoPair, name: 'Two pair', cards: 'Ah Ad 9c 9s 5d', what: 'Two different pairs.' },
  { category: HandCategory.Pair, name: 'One pair', cards: 'Kh Kc Td 6s 2c', what: 'Two cards of the same rank. The other three cards (kickers) break ties.' },
  { category: HandCategory.HighCard, name: 'High card', cards: 'Ac Jd 8h 5s 3c', what: 'Nothing matches. The highest card wins, then the next highest.' },
];

export const STARTING: { level: StrengthLevel; name: string; examples: string[]; what: string }[] = [
  { level: 4, name: 'Very strong', examples: ['As Ad', 'Kh Kc', 'Qs Qd', 'As Ks'], what: 'Big pairs and ace-king. Raise with these from any seat.' },
  { level: 3, name: 'Strong', examples: ['Th Td', 'Ah Qh', 'Ks Qs', 'Ac Kd'], what: 'Good high cards and medium-high pairs. Usually worth a raise.' },
  { level: 2, name: 'Decent', examples: ['8s 8d', 'Kc Qd', 'Kc Jd', '9s 8s'], what: 'Playable, especially from late seats or when nobody raised.' },
  { level: 1, name: 'Marginal', examples: ['5c 5d', 'Ad 5c', 'Qc 9d', 'Tc 8d'], what: 'Small pairs and weaker hands. Only cheap, from good seats.' },
  { level: 0, name: 'Weak', examples: ['7c 2d', 'Jd 3c', '8h 3s', 'Kc 2d'], what: 'Usually fold. Folding before the flop costs nothing.' },
];

interface Props {
  tab: GuideTab;
  onTab: (t: GuideTab) => void;
  strength: HandStrength | null;
  heroCards: string | null;
  onClose: () => void;
}

export function HandGuide({ tab, onTab, strength, heroCards, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: { id: GuideTab; label: string }[] = [
    { id: 'mine', label: 'My hand' },
    { id: 'rankings', label: 'What beats what' },
    { id: 'starting', label: 'Starting hands' },
    { id: 'words', label: 'Poker words' },
  ];

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={onClose}>
      <div className="drawer__panel guide" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2 id="guide-title">Hand guide</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>
        <div className="guide__tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'mine' && <MyHand strength={strength} heroCards={heroCards} onTab={onTab} />}
        {tab === 'rankings' && <Rankings current={strength?.category ?? null} />}
        {tab === 'starting' && <Starting current={strength && strength.category === null ? strength.level : null} />}
        {tab === 'words' && <Words />}
      </div>
    </div>
  );
}

function Meter({ level }: { level: StrengthLevel }) {
  return (
    <span className={`meter meter--${level}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i <= level ? 'is-on' : ''} />)}
    </span>
  );
}

export function StrengthMeter({ level }: { level: StrengthLevel }) {
  return <Meter level={level} />;
}

function MyHand({ strength, heroCards, onTab }: { strength: HandStrength | null; heroCards: string | null; onTab: (t: GuideTab) => void }) {
  if (!strength || !heroCards) {
    return <p className="guide__empty">You don't have cards right now. When a hand is dealt, this shows what you hold and how good it is.</p>;
  }
  const marked = new Set<string>();
  return (
    <section className="guide__mine">
      <div className="guide__mine-head">
        <div className="guide__mine-cards">
          {parseCards(heroCards).map((c, i) => <PlayingCard key={i} card={c} size="md" />)}
        </div>
        <div>
          <div className="guide__mine-title">{strength.title}</div>
          <div className={`guide__mine-level level--${strength.level}`}><Meter level={strength.level} /> {strength.label}</div>
        </div>
      </div>
      <ul className="guide__points">
        {strength.points.map((p, i) => <li key={i}><RichText text={p} marked={marked} /></li>)}
      </ul>
      <p className="guide__aside">
        {strength.category === null
          ? <>Want the full picture? See <button className="linkbtn" onClick={() => onTab('starting')}>starting hands</button>.</>
          : <>Where does this sit? See <button className="linkbtn" onClick={() => onTab('rankings')}>what beats what</button>.</>}
        {' '}The rating is a guide for beginners, not a rule. How others bet matters too.
      </p>
    </section>
  );
}

function Rankings({ current }: { current: HandCategory | null }) {
  return (
    <section>
      <p className="guide__lede">Your hand is the best five cards from your two plus the five shared cards. Higher on this list wins.</p>
      <ol className="ranklist">
        {RANKINGS.map((r) => (
          <li key={r.name} className={current === r.category ? 'is-current' : ''}>
            <div className="ranklist__cards">{parseCards(r.cards).map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}</div>
            <div className="ranklist__text">
              <span className="ranklist__name">{r.name}{current === r.category && <span className="ranklist__you">You have this</span>}</span>
              <span className="ranklist__what">{r.what}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Starting({ current }: { current: StrengthLevel | null }) {
  return (
    <section>
      <p className="guide__lede">Before the flop you only have two cards. Ask four questions:</p>
      <ol className="guide__checks">
        <li><strong>Is it a pair?</strong> Pairs start ahead. The higher the better.</li>
        <li><strong>Are both cards high (10 or above)?</strong> High cards make high pairs.</li>
        <li><strong>Same suit?</strong> A small bonus: you might make a flush.</li>
        <li><strong>Close together (like 9-8)?</strong> They can make straights.</li>
      </ol>
      <ul className="tierlist">
        {STARTING.map((t) => (
          <li key={t.level} className={current === t.level ? 'is-current' : ''}>
            <div className="tierlist__head">
              <span className={`tierlist__name level--${t.level}`}><Meter level={t.level} /> {t.name}</span>
              {current === t.level && <span className="ranklist__you">Your hand</span>}
            </div>
            <div className="tierlist__examples">
              {t.examples.map((ex) => (
                <span key={ex} className="tierlist__pair">{parseCards(ex).map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}</span>
              ))}
            </div>
            <p>{t.what}</p>
          </li>
        ))}
      </ul>
      <p className="guide__aside">Where you sit matters too: from the button you can play more of these; acting first, stick to the top two groups.</p>
    </section>
  );
}

function Words() {
  const groups = [...new Set(GLOSSARY.map((g) => g.group))];
  return (
    <section>
      <p className="guide__lede">Underlined words in the coach's notes show these explanations when you hover or tap them.</p>
      {groups.map((g) => (
        <div key={g} className="wordgroup">
          <h3>{g}</h3>
          <dl>
            {GLOSSARY.filter((e: GlossaryEntry) => e.group === g).map((e) => (
              <div key={e.id}><dt>{e.term}</dt><dd>{e.definition}</dd></div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
