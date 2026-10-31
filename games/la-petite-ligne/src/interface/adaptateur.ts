/**
 * Adaptateur vers les champs et intentions que l'interface a demandés au dev
 * gameplay (`ETAT.md`, « Demandes de l'interface ») et qui n'existent pas
 * encore dans `etat/`. Chaque lecture vérifie le champ à l'exécution: tant
 * qu'il manque, l'interface se rabat sur un comportement local, décrit ici.
 * Quand un champ arrive dans `etat/types.ts`, on remplace la lecture par un
 * accès direct et on retire la fonction.
 */
import type { Intent } from '../etat/actions';
import type { CharacterId, GameNotification, PlacementPreview, ReadonlyWorld } from '../etat/types';

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function characterRecord(world: ReadonlyWorld, id: CharacterId): Readonly<Record<string, unknown>> | null {
  return record(world.characters.find((c) => c.id === id));
}

/** Synchronisation de l'écran titre (demande 3): `Character.titleReady` et phase `title`. */
export interface TitleSync {
  supported: boolean;
  ready: Readonly<Record<CharacterId, boolean>>;
  /** La simulation a une phase « titre » en cours. */
  inTitlePhase: boolean;
}

export function titleSync(world: ReadonlyWorld): TitleSync {
  const p1 = characterRecord(world, 'p1')?.titleReady;
  const p2 = characterRecord(world, 'p2')?.titleReady;
  const supported = typeof p1 === 'boolean' && typeof p2 === 'boolean';
  return {
    supported,
    ready: { p1: p1 === true, p2: p2 === true },
    inTitlePhase: (world.phase as string) === 'title',
  };
}

/** « Continuer » de l'écran de fin (demande 4): `Character.endReady`. */
export function endSync(world: ReadonlyWorld): { supported: boolean; ready: Readonly<Record<CharacterId, boolean>> } {
  const p1 = characterRecord(world, 'p1')?.endReady;
  const p2 = characterRecord(world, 'p2')?.endReady;
  return { supported: typeof p1 === 'boolean' && typeof p2 === 'boolean', ready: { p1: p1 === true, p2: p2 === true } };
}

/** Raison d'un refus de pose (demande 5): `PlacementPreview.blocked`, texte prêt à afficher. */
export function placementBlockedReason(placement: Readonly<PlacementPreview>): string | null {
  const reason = record(placement)?.blocked;
  return typeof reason === 'string' && reason !== '' ? reason : null;
}

/** Clé du message d'une notification (demande 6): `GameNotification.key`. */
export function notificationKey(notification: Readonly<GameNotification>): string | null {
  const key = record(notification)?.key;
  return typeof key === 'string' ? key : null;
}

/** L'horloge attend un joueur absent (demande 7, P1): `ClockStop` « absence ». */
export function clockWaitsForAbsence(world: ReadonlyWorld): boolean {
  return (world.clock.stoppedBy as string | null) === 'absence';
}

/** Intentions demandées, pas encore dans `etat/actions.ts`. */
export type PendingIntent = { type: 'title_ready'; ready: boolean } | { type: 'end_ready'; ready: boolean };

/**
 * Envoie une intention demandée seulement si l'état montre que la simulation
 * la connaît (le champ correspondant existe); sinon l'interface reste locale.
 * Renvoie vrai si l'intention est partie.
 */
export function sendPending(world: ReadonlyWorld, send: (intent: Intent) => void, intent: PendingIntent): boolean {
  const supported = intent.type === 'title_ready' ? titleSync(world).supported : endSync(world).supported;
  if (!supported) return false;
  // Conversion voulue: l'intention n'est pas encore dans l'union `Intent`, mais la
  // simulation l'accepte puisque l'état porte le champ qui lui correspond.
  send(intent as unknown as Intent);
  return true;
}
