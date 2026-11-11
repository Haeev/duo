// Conversations et comptoirs des parcours à deux, pilotés par l'état de l'écran et jamais par des
// pauses fixes. Deux pièges du jeu, voulus pour les joueurs, rendaient les parcours instables sur
// une machine chargée:
// - dans une conversation, Espace valide le choix au focus dès que les choix sont affichés: un
//   Espace « pour passer la réplique » parti trop tôt ou trop tard répondait à la place du joueur;
// - après la fermeture d'un écran, la touche d'action est ignorée 300 ms (`entrees/reglages.ts`):
//   un Espace enchaîné aussitôt était avalé.
// Ici, Espace ne part que sur une réplique entièrement affichée et pas encore passée, et un appui
// d'action n'est rejoué que si l'état prouve qu'il n'a rien fait.
import type { Side } from './duo';

/** Ce que montre la fenêtre de dialogue de cette machine. */
export interface TalkScreen {
  /**
   * `closed`: pas de conversation; `typing`: le texte défile encore; `line`: réplique entièrement
   * affichée, la touche « suite » est proposée; `choice`: les choix sont affichés.
   */
  readonly state: 'closed' | 'typing' | 'line' | 'choice';
  readonly text: string;
  readonly choices: readonly string[];
  /** Texte du choix au focus (`''` hors d'un choix). */
  readonly focused: string;
}

export async function talkScreen(side: Side): Promise<TalkScreen> {
  return await side.game().evaluate((): TalkScreen => {
    const visible = (e: Element | null): e is HTMLElement =>
      e instanceof HTMLElement && !e.hidden && e.checkVisibility();
    const txt = (e: Element | null): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const layer = document.querySelector('.lpl-ui .dialogue');
    if (!visible(layer)) return { state: 'closed', text: '', choices: [], focused: '' };
    const text = txt(layer.querySelector('.dlg__text'));
    const box = layer.querySelector('.choices');
    const choices = visible(box) ? Array.from(box.querySelectorAll('.choice')).map(txt) : [];
    if (choices.length > 0)
      return {
        state: 'choice',
        text,
        choices,
        focused: txt(box?.querySelector('.choice.focus') ?? null),
      };
    const state = visible(layer.querySelector('.dlg__next')) ? 'line' : 'typing';
    return { state, text, choices: [], focused: '' };
  });
}

/** Relit `read` toutes les 100 ms jusqu'à ce que `done` l'accepte; `null` si le délai passe. */
async function poll<T>(
  side: Side,
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs: number,
): Promise<T | null> {
  const t0 = Date.now();
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() - t0 > timeoutMs) return null;
    await side.page.waitForTimeout(100);
  }
}

/** Délai au bout duquel un appui resté sans aucun effet à l'écran est tenu pour avalé, et rejoué. */
const SWALLOWED_MS = 5000;

/**
 * Lit la conversation ouverte sur cette machine jusqu'aux prochains choix ou jusqu'à sa fermeture,
 * et rend les répliques lues. Espace ne part que sur une réplique entièrement affichée (jamais
 * pendant le défilement, jamais sur des choix); la réplique suivante est attendue à l'écran.
 */
export async function readTalk(
  side: Side,
  timeoutMs = 90_000,
): Promise<{ readonly lines: string[]; readonly end: TalkScreen }> {
  const lines: string[] = [];
  const t0 = Date.now();
  for (;;) {
    const screen = await poll(
      side,
      () => talkScreen(side),
      (s) => s.state !== 'typing',
      30_000,
    );
    if (screen === null) throw new Error(`Délai dépassé (${side.who}): la réplique défile encore`);
    if (screen.state !== 'line') return { lines, end: screen };
    if (lines.at(-1) !== screen.text) lines.push(screen.text);
    if (Date.now() - t0 > timeoutMs)
      throw new Error(`Délai dépassé (${side.who}): conversation sans fin (${lines.join(' | ')})`);
    await side.press('Space');
    // La suite arrive en un aller-retour: autre texte, choix, ou fermeture. Sans rien de neuf au
    // bout de `SWALLOWED_MS`, l'appui a été avalé: le tour suivant le rejoue sur la même réplique.
    await poll(
      side,
      () => talkScreen(side),
      (s) => s.state !== 'line' || s.text !== screen.text,
      SWALLOWED_MS,
    );
  }
}

/**
 * Sur des choix affichés: porte le focus sur l'option dont le texte contient `option` (touche S,
 * le bas d'un AZERTY comme d'un QWERTY), la valide (Entrée) et attend que les choix s'effacent.
 */
export async function pickChoice(side: Side, option: string): Promise<string> {
  const start = await talkScreen(side);
  if (start.state !== 'choice') throw new Error(`${side.who}: pas de choix à l’écran`);
  if (!start.choices.some((c) => c.includes(option)))
    throw new Error(`${side.who}: aucun choix « ${option} » parmi ${start.choices.join(' / ')}`);
  let focused = start.focused;
  for (let i = 0; i < start.choices.length && !focused.includes(option); i++) {
    const before = focused;
    await side.press('KeyS');
    const moved = await poll(
      side,
      () => talkScreen(side),
      (s) => s.state !== 'choice' || s.focused !== before,
      SWALLOWED_MS,
    );
    focused = moved?.focused ?? before;
  }
  if (!focused.includes(option))
    throw new Error(`${side.who}: le focus n’atteint pas le choix « ${option} » (${focused})`);
  await side.press('Enter');
  const after = await poll(
    side,
    () => talkScreen(side),
    (s) => s.state !== 'choice' || s.choices.join('|') !== start.choices.join('|'),
    20_000,
  );
  if (after === null) throw new Error(`${side.who}: le choix « ${option} » n’a pas été pris`);
  return focused;
}

/**
 * Lit toute la conversation ouverte, en prenant le premier choix à chaque fois (Entrée), jusqu'à
 * sa fermeture. Rend les pages lues; les choix proposés y figurent en « CHOIX: a / b ».
 */
export async function readToEnd(side: Side): Promise<string[]> {
  const pages: string[] = [];
  for (let i = 0; i < 12; i++) {
    const { lines, end } = await readTalk(side);
    pages.push(...lines);
    if (end.state !== 'choice') return pages;
    pages.push(`CHOIX: ${end.choices.join(' / ')}`);
    const first = end.choices[0];
    if (first === undefined) return pages;
    await pickChoice(side, first);
  }
  throw new Error(`${side.who}: conversation sans fin (${pages.join(' | ')})`);
}

/**
 * Appuie sur la touche d'action et attend son effet (`done`). L'appui ne part que si `ready` le
 * permet (bonne cible visée, rien d'ouvert); resté sans effet (touche ignorée 300 ms après la
 * fermeture d'un écran), il est rejoué, `ready` revérifié à chaque fois. `describe`: l'état à
 * joindre au message si le délai passe (ce que vise le joueur, où il est).
 */
export async function actUntil(
  side: Side,
  label: string,
  ready: () => Promise<boolean>,
  done: () => Promise<boolean>,
  options: { readonly timeoutMs?: number; readonly describe?: () => Promise<string> } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 40_000;
  const t0 = Date.now();
  let presses = 0;
  for (;;) {
    if (await done()) return;
    if (Date.now() - t0 > timeoutMs)
      throw new Error(
        `Délai dépassé (${side.who}): ${label}; ${String(presses)} appui(s); ${(await options.describe?.()) ?? ''}`,
      );
    if (await ready()) {
      presses += 1;
      await side.press('Space');
      await poll(side, done, (ok) => ok, SWALLOWED_MS);
    } else await side.page.waitForTimeout(100);
  }
}
