import { CSSProperties } from 'react';
import { describePartial, evaluateBest } from '../engine/evaluator';
import { ActionRecord, GameState, POSITION_LABELS, Player, positionOf, totalPot } from '../engine/game';
import { BotProfile, STYLE_LABELS } from '../ai/bot';
import { PlayingCard } from './Card';
import { ChipStack, formatChips } from './Chips';

interface Props {
  game: GameState;
  heroSeat: number;
  bots: Record<number, BotProfile>;
  sweeping: boolean;
}

/** Seat anchor on the rail, as % of the table box. Seat 0 (you) sits at the bottom; others go clockwise. */
function seatPoint(index: number, count: number, k = 1) {
  const angle = ((90 + (index * 360) / count) * Math.PI) / 180;
  return { x: 50 + 50 * Math.cos(angle) * k, y: 50 + 50 * Math.sin(angle) * k };
}

function lastAction(log: ActionRecord[], seat: number, street: string): ActionRecord | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const r = log[i];
    if (r.street !== street) return undefined;
    if (r.seat === seat) return r;
  }
  return undefined;
}

function actionLabel(r: ActionRecord): string {
  if (r.allIn && r.kind !== 'fold') return 'All-in';
  switch (r.kind) {
    case 'post-sb': return 'Small blind';
    case 'post-bb': return 'Big blind';
    case 'fold': return 'Fold';
    case 'check': return 'Check';
    case 'call': return 'Call';
    case 'bet': return 'Bet';
    case 'raise': return 'Raise';
  }
}

const AVATAR_TONES = ['#7a4e2d', '#2f5d62', '#6b3a4b', '#4a5a2a', '#3d4a6b', '#6b5a2e', '#5a3d6b', '#2e5a45'];

export function Table({ game, heroSeat, bots, sweeping }: Props) {
  const n = game.players.length;
  const result = game.result;
  const showdown = !!result && !result.uncontested;
  const winners = new Set(result ? result.pots.flatMap((p) => p.winners) : []);
  const winningCards = showdown ? result!.pots[0].hand?.cards ?? [] : [];
  const isWinningCard = (c: { rank: number; suit: string }) => winningCards.some((w) => w.rank === c.rank && w.suit === c.suit);
  const hero = game.players[heroSeat];
  const heroHand = hero.hole.length
    ? game.board.length >= 3 ? evaluateBest([...hero.hole, ...game.board]).name : describePartial(hero.hole)
    : '';
  const street = game.phase === 'complete' || game.phase === 'showdown' ? '' : game.phase;
  const pot = game.pot;
  const total = totalPot(game);

  return (
    <div className="table" data-players={n}>
      <div className="table__rail">
        <div className="table__felt">
          <div className="table__lamp" aria-hidden />
          <div className="table__wordmark" aria-hidden>Kicker</div>

          <div className="pot" data-coach="pot" aria-live="polite">
            <ChipStack amount={pot} label={false} className="pot__chips" />
            <div className="pot__label">
              <span>Pot</span> <strong>{formatChips(result ? result.pots.reduce((s, p) => s + p.amount, 0) : total)}</strong>
            </div>
          </div>

          <div className="board" data-coach="board" aria-label="Community cards">
            {[0, 1, 2, 3, 4].map((i) => {
              const c = game.board[i];
              return c ? (
                <PlayingCard
                  key={`${game.handNumber}-${i}`}
                  card={c}
                  size="lg"
                  enter="flip"
                  delay={i < 3 ? i : 0}
                  highlight={showdown && isWinningCard(c)}
                  dim={showdown && !isWinningCard(c)}
                />
              ) : (
                <div key={i} className="board__slot" aria-hidden />
              );
            })}
          </div>
        </div>
      </div>

      {game.players.map((p, i) => {
        const pt = seatPoint(i, n);
        const dir = seatPoint(i, n);
        const btnPt = seatPoint(i + 16 / (360 / n), n, 0.76);
        const last = street ? lastAction(game.log, p.seat, street) : undefined;
        const bot = bots[p.seat];
        return (
          <div key={p.seat} className="seat-layer">
            <Seat
              player={p}
              isHero={p.seat === heroSeat}
              bot={bot}
              tone={AVATAR_TONES[(bot ? bot.id.charCodeAt(0) : 0) % AVATAR_TONES.length]}
              active={game.toAct === p.seat}
              winner={winners.has(p.seat)}
              reveal={showdown && !p.folded}
              last={last}
              position={positionOf(game, p.seat)}
              handNumber={game.handNumber}
              dealIndex={i}
              winningCard={isWinningCard}
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
              payout={result?.payouts[p.seat]}
            />
            {p.bet > 0 && (
              <div
                className={`bet ${p.seat === heroSeat ? 'bet--hero' : ''} ${dir.y < 10 ? 'bet--top' : ''} ${sweeping ? 'is-sweeping' : ''}`}
                style={{ '--px': dir.x - 50, '--py': dir.y - 50 } as CSSProperties}
              >
                <ChipStack amount={p.bet} />
              </div>
            )}
            {game.button === p.seat && (
              <div
                className={`dealer-button ${p.seat === heroSeat ? 'dealer-button--hero' : ''}`}
                data-coach="button"
                style={p.seat === heroSeat ? undefined : { left: `${btnPt.x}%`, top: `${btnPt.y}%` }}
                title="Dealer button"
              >
                D
              </div>
            )}
          </div>
        );
      })}

      <div className="hero-hand" data-coach="hero-cards">
        <div className="hero-hand__cards">
          {hero.hole.map((c, i) => (
            <PlayingCard
              key={`${game.handNumber}-h${i}`}
              card={c}
              size="lg"
              enter="deal"
              delay={i * n}
              highlight={showdown && winners.has(heroSeat) && isWinningCard(c)}
              dim={hero.folded}
            />
          ))}
        </div>
        {heroHand && !hero.folded && <div className="hero-hand__name">{heroHand}</div>}
        {hero.folded && <div className="hero-hand__name is-muted">Folded</div>}
      </div>
    </div>
  );
}

interface SeatProps {
  player: Player;
  isHero: boolean;
  bot?: BotProfile;
  tone: string;
  active: boolean;
  winner: boolean;
  reveal: boolean;
  last?: ActionRecord;
  position: ReturnType<typeof positionOf>;
  handNumber: number;
  dealIndex: number;
  winningCard: (c: { rank: number; suit: string }) => boolean;
  style: CSSProperties;
  payout?: number;
}

function Seat({ player: p, isHero, bot, tone, active, winner, reveal, last, position, handNumber, dealIndex, winningCard, style, payout }: SeatProps) {
  const cls = [
    'seat', isHero ? 'seat--hero' : '', active ? 'is-active' : '', p.folded ? 'is-folded' : '', p.allIn ? 'is-allin' : '',
    winner ? 'is-winner' : '', p.out ? 'is-out' : '',
  ].filter(Boolean).join(' ');
  const status = p.out ? 'Sitting out' : p.folded ? 'Folded' : p.allIn ? 'All-in' : active ? 'Thinking' : '';
  return (
    <div
      className={cls}
      style={{ ...style, '--tone': tone } as CSSProperties}
      aria-label={`${p.name}${isHero ? '' : `, ${bot ? STYLE_LABELS[bot.style] : ''}`}, ${formatChips(p.stack)} chips${status ? `, ${status}` : ''}`}
    >
      {!isHero && !p.out && (
        <div className={`seat__cards ${reveal ? 'is-revealed' : ''}`}>
          {p.hole.map((c, i) => (
            <PlayingCard
              key={`${handNumber}-${p.seat}-${i}`}
              card={c}
              faceDown={!reveal}
              size="sm"
              enter={reveal ? 'flip' : 'deal'}
              delay={reveal ? i : i * 6 + dealIndex}
              highlight={reveal && winner && winningCard(c)}
            />
          ))}
        </div>
      )}
      <div className="seat__plate">
        <div className="seat__avatar" aria-hidden>{isHero ? 'You'.slice(0, 1) : p.name.slice(0, 1)}</div>
        <div className="seat__meta">
          <div className="seat__name">
            {p.name}
            {position && <span className="seat__pos" title={POSITION_LABELS[position]}>{position}</span>}
          </div>
          <div className="seat__stack">{formatChips(p.stack)}</div>
        </div>
        {active && <div className="seat__timer" aria-hidden />}
      </div>
      {bot && <div className="seat__style">{STYLE_LABELS[bot.style]}</div>}
      {last && !winner && <div key={`${last.kind}-${last.betTo}`} className={`seat__action seat__action--${last.kind}`}>{actionLabel(last)}</div>}
      {winner && payout ? <div className="seat__action seat__action--win">+{formatChips(payout)}</div> : null}
    </div>
  );
}
