/**
 * Choix du focus: élément par défaut de chaque écran (maquettes, section 6)
 * et navigation spatiale aux flèches et à Z Q S D (section 4). Fonctions
 * pures: les composants leur donnent des positions et des états.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

const VECTORS: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Direction d'une touche de navigation. Les lettres sont lues par position
 * (`KeyW` est le Z d'un clavier AZERTY): Z Q S D, comme pour marcher.
 */
export function directionOf(code: string, allowLetters: boolean): Direction | null {
  switch (code) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'KeyW':
      return allowLetters ? 'up' : null;
    case 'KeyS':
      return allowLetters ? 'down' : null;
    case 'KeyA':
      return allowLetters ? 'left' : null;
    case 'KeyD':
      return allowLetters ? 'right' : null;
    default:
      return null;
  }
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Seuil sous lequel un voisin n'est pas « dans la direction » (px). */
const AXIS_MIN = 4;
/** Poids de l'écart en travers de la direction. */
const CROSS_WEIGHT = 2.5;

/**
 * L'élément le plus proche dans la direction demandée (comportement de
 * référence de `ui-maquettes/support/maquette.js`): couvre listes, rangées et
 * grilles de formes différentes. Renvoie l'index dans `candidates`, ou -1.
 */
export function spatialNeighbour(from: Box, candidates: readonly Box[], direction: Direction): number {
  const [dx, dy] = VECTORS[direction];
  const x0 = from.x + from.w / 2;
  const y0 = from.y + from.h / 2;
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  candidates.forEach((box, index) => {
    const x = box.x + box.w / 2;
    const y = box.y + box.h / 2;
    const axis = (x - x0) * dx + (y - y0) * dy;
    if (axis <= AXIS_MIN) return;
    const cross = Math.abs((x - x0) * dy) + Math.abs((y - y0) * dx);
    const score = axis + cross * CROSS_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** Index suivant ou précédent, en boucle. */
export function cycle(index: number, length: number, delta: number): number {
  if (length <= 0) return -1;
  return (((index + delta) % length) + length) % length;
}

// ---------------------------------------------------------------------------
// Focus par défaut (maquettes, section 6)

/** Sac: la case de l'outil en main si elle est occupée, sinon la première case occupée, sinon la première. */
export function defaultBagSlot(occupied: readonly boolean[], selected: number): number {
  if (occupied[selected] === true) return selected;
  const first = occupied.indexOf(true);
  return first >= 0 ? first : 0;
}

/** Caisse: le premier « Déposer » possible, sinon la première ligne. */
export function defaultCrateLine(lines: readonly { canDeposit: boolean }[]): number {
  const first = lines.findIndex((l) => l.canDeposit);
  return first >= 0 ? first : 0;
}

/** Catalogue et comptoir: le premier article qu'on peut prendre, sinon le premier. */
export function defaultProduct(products: readonly { available: boolean }[]): number {
  const first = products.findIndex((p) => p.available);
  return first >= 0 ? first : 0;
}

/** Quêtes: la quête en cours (prochain objectif), sinon la première non finie, sinon la première. */
export function defaultQuest(quests: readonly { id: string; done: boolean }[], current: string | null): number {
  const byId = current === null ? -1 : quests.findIndex((q) => q.id === current);
  if (byId >= 0) return byId;
  const open = quests.findIndex((q) => !q.done);
  return open >= 0 ? open : 0;
}

/** Courrier: la plus ancienne lettre non lue, sinon la dernière arrivée (en tête de liste). */
export function defaultLetter(letters: readonly { unread: boolean }[]): number {
  for (let i = letters.length - 1; i >= 0; i--) if (letters[i]?.unread === true) return i;
  return 0;
}

/** Dialogue: ma réplique déjà choisie, sinon la première réplique active, sinon le bouton « Suite » (-1). */
export function defaultChoice(choices: readonly { pressed: boolean; disabled: boolean }[]): number {
  const pressed = choices.findIndex((c) => c.pressed);
  if (pressed >= 0) return pressed;
  return choices.findIndex((c) => !c.disabled);
}

/** Écran de nuit: le choix déjà fait, sinon « Continuer ». */
export function defaultNightButton(choice: 'continue' | 'finish' | null): 'continue' | 'finish' {
  return choice ?? 'continue';
}
