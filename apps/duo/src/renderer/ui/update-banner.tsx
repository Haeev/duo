// Bandeau de mise à jour d'un jeu (patch 0.3.1), sur sa carte et dans son salon:
// progression, installation, « À jour », ou échec avec « Réessayer » et
// « Jouer quand même ».
import type { JSX } from 'preact';
import { send } from '../bridge';
import { de, fr, percent } from '../textes';
import type { GameSummary } from '../../shared/state';
import { launchGate, type LaunchGate, type UpdateCheckView } from '../../shared/updates';

export const majTextes = {
  progression: (game: string, version: string, value: number): string =>
    fr`Mise à jour ${de(game)} vers ${version} : ${percent(value)}`,
  attente: (game: string, version: string): string =>
    fr`Mise à jour ${de(game)} vers ${version} : en attente`,
  installation: (game: string, version: string): string =>
    fr`Mise à jour ${de(game)} vers ${version} : installation`,
  aJour: (game: string, version: string): string => fr`${game} est à jour (version ${version}).`,
  echec: (game: string, version: string): string =>
    fr`La mise à jour ${de(game)} vers ${version} n'a pas pu se faire. Vérifie la connexion à Internet, puis réessaie.`,
  reessayer: 'Réessayer',
  jouerQuandMeme: (version: string): string => fr`Jouer quand même (version ${version})`,
  raisonMaj: fr`Attends la fin de la mise à jour pour jouer.`,
  raisonEchec: fr`Réessaie la mise à jour, ou choisis de jouer quand même.`,
  raisonVerification: fr`Vérification des mises à jour...`,
  injoignable: fr`Impossible de vérifier les mises à jour.`,
};

export function gateFor(game: GameSummary, check: UpdateCheckView): LaunchGate {
  return launchGate(game.update, check);
}

/** Raison affichée sous un bouton désactivé, `null` si le jeu se lance. */
export function gateReason(gate: LaunchGate): string | null {
  switch (gate.kind) {
    case 'open':
      return null;
    case 'checking':
      return majTextes.raisonVerification;
    case 'updating':
      return majTextes.raisonMaj;
    case 'failed':
      return majTextes.raisonEchec;
  }
}

export function UpdateBanner({ game }: { game: GameSummary }): JSX.Element | null {
  const update = game.update;
  if (update === null) return null;
  const testId = `maj-${game.id}`;
  switch (update.kind) {
    case 'available':
    case 'downloading':
    case 'installing': {
      const value =
        update.kind === 'downloading' ? update.progress : update.kind === 'installing' ? 1 : 0;
      const label =
        update.kind === 'downloading'
          ? majTextes.progression(game.name, update.version, value)
          : update.kind === 'installing'
            ? majTextes.installation(game.name, update.version)
            : majTextes.attente(game.name, update.version);
      return (
        <div class="bandeau-maj" role="status" data-testid={testId} data-etat={update.kind}>
          <p class="petit">{label}</p>
          <div
            class="barre-maj"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value * 100)}
          >
            <span
              class={`barre-maj-plein${update.kind === 'installing' ? ' barre-maj-installation' : ''}`}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
        </div>
      );
    }
    case 'done':
      return (
        <div class="bandeau-maj bandeau-maj-ok" role="status" data-testid={testId} data-etat="done">
          <p class="petit">{majTextes.aJour(game.name, update.version)}</p>
        </div>
      );
    case 'failed':
      if (update.playAnyway) return null;
      return (
        <div
          class="bandeau-maj bandeau-maj-echec"
          role="alert"
          data-testid={testId}
          data-etat="failed"
        >
          <p class="petit">{majTextes.echec(game.name, update.version)}</p>
          <div class="bandeau-maj-actions">
            <button
              type="button"
              class="bouton bouton-principal"
              data-testid={`${testId}-reessayer`}
              onClick={() => {
                void send('update:retry', null);
              }}
            >
              {majTextes.reessayer}
            </button>
            <button
              type="button"
              class="bouton bouton-secondaire"
              data-testid={`${testId}-jouer`}
              onClick={() => {
                void send('update:play-anyway', { gameId: game.id });
              }}
            >
              {majTextes.jouerQuandMeme(game.version)}
            </button>
          </div>
        </div>
      );
  }
}
