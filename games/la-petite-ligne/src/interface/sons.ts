/**
 * Sons de l'interface (demandes 7 et 14 de l'audio, `ETAT.md`): quel son pour
 * quel geste, et un portillon qui empêche les rafales. Module pur, testé dans Node.
 * L'interface ne sonne jamais au survol, ni pour un focus posé par le programme.
 */
import { UI_SETTINGS } from './config';

export type UiSoundId = keyof typeof UI_SETTINGS.soundMinMs;

/** `data-sound` d'un bouton: son voulu au clic, ou `none` (son joué ailleurs). */
export const SOUND_ATTR = 'data-sound';

/** Menus dont l'audio du monde joue déjà l'ouverture (carnet, lettre, coffre) ou la fermeture (coffre). */
const OPEN_COVERED: ReadonlySet<string> = new Set(['notebook', 'letter', 'chest']);
const CLOSE_COVERED: ReadonlySet<string> = new Set(['chest']);

const SOUND_IDS: ReadonlySet<string> = new Set(Object.keys(UI_SETTINGS.soundMinMs));

function isSoundId(value: string): value is UiSoundId {
  return SOUND_IDS.has(value);
}

export interface ButtonFacts {
  readonly disabled: boolean;
  readonly ariaDisabled: string | null;
  readonly sound: string | null;
}

/** Son d'un bouton validé (clic ou Entrée): `ui-confirm` par défaut, refus s'il est désactivé. */
export function buttonSound(facts: ButtonFacts): UiSoundId | null {
  if (facts.sound === 'none') return null;
  if (facts.disabled || facts.ariaDisabled === 'true') return 'ui-refusal';
  if (facts.sound !== null && isSoundId(facts.sound)) return facts.sound;
  return 'ui-confirm';
}

export interface MountedFacts {
  readonly kind: 'screen' | 'dialogue' | 'panel';
  readonly key: string;
}

function menuOf(facts: MountedFacts | null): string | null {
  if (facts?.kind !== 'panel') return null;
  return facts.key.startsWith('panel:') ? facts.key.slice('panel:'.length) : facts.key;
}

/** Sons d'un changement de couche: ouverture et fermeture des panneaux. */
export function layerSounds(previous: MountedFacts | null, next: MountedFacts | null): UiSoundId[] {
  if ((previous?.key ?? null) === (next?.key ?? null)) return [];
  const before = menuOf(previous);
  const after = menuOf(next);
  if (after !== null) return OPEN_COVERED.has(after) ? [] : ['ui-panel-open'];
  if (before !== null) return CLOSE_COVERED.has(before) ? [] : ['ui-panel-close'];
  return [];
}

/** Portillon: un même son pas plus souvent que `UI_SETTINGS.soundMinMs`. */
export class UiSoundGate {
  private readonly last = new Map<UiSoundId, number>();

  constructor(private readonly output: ((id: string) => void) | null) {}

  /** Joue le son si son délai est passé. Vrai s'il est parti. */
  play(id: UiSoundId, now: number): boolean {
    if (this.output === null) return false;
    const last = this.last.get(id);
    if (last !== undefined && now - last < UI_SETTINGS.soundMinMs[id]) return false;
    this.last.set(id, now);
    this.output(id);
    return true;
  }
}
