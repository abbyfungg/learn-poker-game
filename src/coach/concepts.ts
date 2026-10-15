export type ConceptId =
  | 'actions'
  | 'blinds'
  | 'hand-rankings'
  | 'starting-hands'
  | 'position'
  | 'outs'
  | 'pot-odds'
  | 'value-betting'
  | 'showdown';

export interface Concept {
  id: ConceptId;
  title: string;
  /** One-sentence summary used in progress views. */
  summary: string;
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  actions: { id: 'actions', title: 'Check, bet, call, raise, fold', summary: 'What each action does and when it is available.' },
  blinds: { id: 'blinds', title: 'Blinds and the button', summary: 'Forced bets that start the pot, and how the dealer button rotates.' },
  'hand-rankings': { id: 'hand-rankings', title: 'Hand rankings', summary: 'Which five-card hands beat which.' },
  'starting-hands': { id: 'starting-hands', title: 'Starting hands', summary: 'Which two-card hands are worth playing.' },
  position: { id: 'position', title: 'Position', summary: 'Acting last is an advantage; play more hands late, fewer early.' },
  outs: { id: 'outs', title: 'Draws and outs', summary: 'Counting the cards that improve your hand.' },
  'pot-odds': { id: 'pot-odds', title: 'Pot odds', summary: 'Comparing the price of a call with your chance to win.' },
  'value-betting': { id: 'value-betting', title: 'Betting strong hands', summary: 'Betting so worse hands pay you.' },
  showdown: { id: 'showdown', title: 'Showdowns and kickers', summary: 'How the winner is decided, including kickers and split pots.' },
};

export const CONCEPT_ORDER: ConceptId[] = [
  'actions', 'blinds', 'hand-rankings', 'showdown', 'starting-hands', 'position', 'outs', 'pot-odds', 'value-betting',
];
