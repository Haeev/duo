// Mises à jour des jeux vues par l'interface (patch 0.3.1): état de la recherche,
// état par jeu, et règle unique qui dit si l'on peut lancer, héberger ou rejoindre.

/** Recherche du catalogue. `unreachable`: hors ligne ou délai dépassé, on joue quand même. */
export type UpdateCheckView =
  | { readonly kind: 'never' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'ok' }
  | { readonly kind: 'unreachable' };

/**
 * Cause d'un échec, pour le message affiché: `integrity` quand l'archive reçue ne
 * correspond pas à l'empreinte du catalogue (rien n'est installé).
 */
export type UpdateFailureCause = 'download' | 'integrity' | 'install';

/** Mise à jour d'un jeu installé. */
export type GameUpdateView =
  | { readonly kind: 'available'; readonly version: string }
  | { readonly kind: 'downloading'; readonly version: string; readonly progress: number }
  | { readonly kind: 'installing'; readonly version: string }
  | {
      readonly kind: 'failed';
      readonly version: string;
      readonly playAnyway: boolean;
      readonly cause: UpdateFailureCause;
    }
  | { readonly kind: 'done'; readonly version: string };

export type LaunchGate =
  | { readonly kind: 'open' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'updating'; readonly version: string }
  | { readonly kind: 'failed'; readonly version: string };

/**
 * Peut-on lancer ce jeu ? Bloqué pendant le contrôle (quelques secondes au plus),
 * pendant le téléchargement et l'installation, et après un échec tant que le
 * joueur n'a pas choisi « Jouer quand même ». Catalogue injoignable: jamais bloqué.
 */
export function launchGate(update: GameUpdateView | null, check: UpdateCheckView): LaunchGate {
  if (update !== null) {
    switch (update.kind) {
      case 'available':
      case 'downloading':
      case 'installing':
        return { kind: 'updating', version: update.version };
      case 'failed':
        return update.playAnyway ? { kind: 'open' } : { kind: 'failed', version: update.version };
      case 'done':
        return { kind: 'open' };
    }
  }
  return check.kind === 'checking' ? { kind: 'checking' } : { kind: 'open' };
}

/** Pourcentage entier affiché, borné à 0..100. */
export function percent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.floor(progress * 100)));
}
