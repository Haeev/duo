// Avis de nouvelle version de Duo (M-35, ADR 0011), en tête de la bibliothèque.
// Discret: il ne prend pas le focus et ne bloque rien. « Télécharger » ouvre le
// lien dans le navigateur (le principal choisit l'adresse); aucune installation.
import type { JSX } from 'preact';
import type { AppUpdateView } from '../../shared/app-update';
import { send } from '../bridge';
import { t, typo } from '../textes';

export function AppUpdateBanner({ update }: { update: AppUpdateView | null }): JSX.Element | null {
  if (update === null) return null;
  const textes = t.versionDuo;
  return (
    <section
      class="bandeau-maj bandeau-version"
      role="status"
      aria-labelledby="version-duo-titre"
      data-testid="version-duo"
      data-etat={update.kind}
      data-message="M-35"
    >
      <p class="corps-grand" id="version-duo-titre">
        <strong>{textes.titre(update.version)}</strong>
      </p>
      <p class="petit" data-testid="version-duo-resume">
        {typo(update.summary)}
      </p>
      <p class="petit texte-second">
        {update.kind === 'unsupported'
          ? textes.tropAncien(update.system, update.minimum)
          : `${textes.deuxOrdinateurs} ${textes.navigateur}`}
      </p>
      <div class="bandeau-maj-actions">
        {update.kind !== 'unsupported' && (
          <button
            type="button"
            class="bouton bouton-principal"
            data-testid="version-duo-telecharger"
            onClick={() => {
              void send('app-update:download', null);
            }}
          >
            {textes.telecharger}
          </button>
        )}
        <button
          type="button"
          class="bouton bouton-secondaire"
          data-testid="version-duo-plus-tard"
          onClick={() => {
            void send('app-update:later', null);
          }}
        >
          {textes.plusTard}
        </button>
      </div>
    </section>
  );
}
