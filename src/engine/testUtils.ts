import { Card, createRng, parseCards, remainingDeck } from './cards';
import { GameState, SeatConfig, createTable, startHand } from './game';

export function table(stacks: number[], sb = 5, bb = 10, button = -1): GameState {
  const seats: SeatConfig[] = stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack, isHero: i === 0 }));
  const s = createTable(seats, sb, bb);
  // startHand moves the button to the next seat with chips after `button`
  return { ...s, button };
}

/**
 * Start a hand with fixed hole cards and a fixed board (deterministic tests).
 * `holes` is indexed by seat; '' for seats that are out.
 */
export function rigged(base: GameState, holes: string[], board: string): GameState {
  const s = startHand(base, createRng(1));
  const holeCards = holes.map((h) => (h ? parseCards(h) : []));
  const boardCards = parseCards(board);
  const used: Card[] = [...holeCards.flat(), ...boardCards];
  const filler = remainingDeck(used);
  const burns = filler.splice(0, 3);
  // deck is popped from the end: burn, flop x3, burn, turn, burn, river
  const order = [burns[0], ...boardCards.slice(0, 3), burns[1], boardCards[3], burns[2], boardCards[4]].filter(Boolean);
  const deck = [...filler, ...order.reverse()];
  return {
    ...s,
    deck,
    players: s.players.map((p, i) => ({ ...p, hole: p.out ? [] : holeCards[i] })),
  };
}
