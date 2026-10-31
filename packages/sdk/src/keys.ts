// Libellés des touches. Les touches se lisent par `KeyboardEvent.code` (position physique);
// le libellé suit la disposition réelle quand le navigateur la donne, AZERTY sinon.
import type { MouseInput } from './api';

/** Caractères d'un clavier AZERTY français, pour les positions qui diffèrent du nom du code. */
const AZERTY: Readonly<Record<string, string>> = {
  KeyQ: 'A',
  KeyW: 'Z',
  KeyA: 'Q',
  KeyZ: 'W',
  KeyM: ',',
  Semicolon: 'M',
  Comma: ';',
  Period: ':',
  Slash: '!',
  BracketLeft: '^',
  BracketRight: '$',
  Quote: 'ù',
  Backquote: '²',
  Minus: ')',
  Equal: '=',
  Backslash: '*',
  IntlBackslash: '<',
};

const NAMED: Readonly<Record<string, string>> = {
  Space: 'Espace',
  Enter: 'Entrée',
  NumpadEnter: 'Entrée',
  Tab: 'Tab',
  Backspace: 'Retour arrière',
  Delete: 'Suppr',
  Insert: 'Inser',
  Home: 'Début',
  End: 'Fin',
  PageUp: 'Page préc.',
  PageDown: 'Page suiv.',
  ShiftLeft: 'Maj gauche',
  ShiftRight: 'Maj droite',
  ControlLeft: 'Ctrl gauche',
  ControlRight: 'Ctrl droite',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  MetaLeft: 'Cmd',
  MetaRight: 'Cmd',
  CapsLock: 'Verr. maj',
  ArrowUp: 'Flèche haut',
  ArrowDown: 'Flèche bas',
  ArrowLeft: 'Flèche gauche',
  ArrowRight: 'Flèche droite',
};

const MOUSE_LABELS: Readonly<Record<MouseInput, string>> = {
  left: 'Clic gauche',
  middle: 'Clic molette',
  right: 'Clic droit',
  'wheel-up': 'Molette haut',
  'wheel-down': 'Molette bas',
};

/** Correspondance code vers caractère, telle que `navigator.keyboard.getLayoutMap()` la donne. */
export type LayoutMap = ReadonlyMap<string, string>;

/** Libellé d'une touche: disposition fournie si elle connaît la touche, AZERTY sinon. */
export function keyLabel(code: string, layout: LayoutMap | null): string {
  const named = NAMED[code];
  if (named !== undefined) return named;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (digit?.[1] !== undefined) return digit[1];
  const fromLayout = layout?.get(code);
  if (fromLayout !== undefined && fromLayout.length > 0) return fromLayout.toUpperCase();
  const azerty = AZERTY[code];
  if (azerty !== undefined) return azerty.toUpperCase();
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1] !== undefined) return letter[1];
  return code;
}

export function mouseLabel(input: MouseInput): string {
  return MOUSE_LABELS[input];
}

/** Lit la disposition du clavier si le navigateur la donne (contexte sécurisé, Chromium). */
export async function readLayoutMap(): Promise<LayoutMap | null> {
  const keyboard = (
    navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<LayoutMap> } }
  ).keyboard;
  if (keyboard?.getLayoutMap === undefined) return null;
  try {
    return await keyboard.getLayoutMap();
  } catch {
    return null;
  }
}
