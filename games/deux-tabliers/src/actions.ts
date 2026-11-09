// Actions du manifeste (`duo-game.json`): touches lues par position (`KeyboardEvent.code`).
export type GameAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'fast'
  | 'act'
  | 'drop'
  | 'rotate'
  | 'wave'
  | 'tablet'
  | 'arrange'
  | 'close'
  | 'confirm';
