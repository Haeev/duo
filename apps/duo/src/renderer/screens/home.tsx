// Accueil (E05), bibliothèque (E07) et bandeau d'invitation (E06), UX section 2.
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { AppState, GameSummary, InvitationView, Profile } from '../../shared/state';
import type { UpdateCheckView } from '../../shared/updates';
import { send } from '../bridge';
import { durationRange, fullscreenKey, t, when } from '../textes';
import { Icon, Logo, PlayerName, PlayerSymbol, Sky } from '../ui/components';
import { markScreenChange, useEscape, useInitialFocus } from '../ui/keyboard';
import { UpdateBanner, gateFor, gateReason, majTextes } from '../ui/update-banner';

export type Tab = 'home' | 'library' | 'settings';

const TABS: readonly { readonly name: Tab; readonly label: string; readonly testId: string }[] = [
  { name: 'home', label: t.nav.accueil, testId: 'onglet-accueil' },
  { name: 'library', label: t.nav.bibliotheque, testId: 'onglet-bibliotheque' },
  { name: 'settings', label: t.nav.reglages, testId: 'onglet-reglages' },
];
export const tab = signal<Tab>('home');

/** Invitation mise de côté par « Plus tard »: elle reste dans le bloc Rejoindre. */
const dismissedInvitation = signal<string | null>(null);

function invitationKey(invitation: InvitationView): string {
  return `${invitation.from.pseudo}:${invitation.game.id}`;
}

function peerName(state: AppState): string | null {
  return state.peer.status === 'unknown' ? null : state.peer.profile.pseudo;
}

function gameDetail(game: GameSummary): string {
  return `${t.jeu.mode(game.mode)} · ${durationRange(game.durationMinutes)}`;
}

function TopBar({ state, profile }: { state: AppState; profile: Profile }): JSX.Element {
  const select = (next: Tab): void => {
    markScreenChange();
    tab.value = next;
  };
  return (
    <header class="barre-haut">
      <Logo />
      <nav class="onglets" aria-label={t.nav.principale}>
        {TABS.map(({ name, label, testId }) => (
          <button
            key={name}
            type="button"
            class={`onglet${tab.value === name ? ' onglet-actif' : ''}`}
            aria-current={tab.value === name ? 'page' : undefined}
            data-testid={testId}
            onClick={() => {
              select(name);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div class="barre-droite">
        {state.peer.status !== 'unknown' && (
          <span class="presence-courte" data-testid="presence-barre" data-message="M-30">
            <PlayerSymbol color={state.peer.profile.color} size={20} />
            {state.peer.status === 'present'
              ? t.presence.la(state.peer.profile.pseudo)
              : t.presence.absent(state.peer.profile.pseudo)}
          </span>
        )}
        <span class="pastille-profil" data-testid="profil-barre">
          <PlayerSymbol color={profile.color} size={20} />
          {profile.pseudo}
        </span>
      </div>
    </header>
  );
}

function PresenceCard({ state, profile }: { state: AppState; profile: Profile }): JSX.Element {
  const peer = state.peer;
  return (
    <div class="carte carte-presence" data-testid="presence" data-message="M-30">
      <span class="presence-joueurs">
        <PlayerName profile={profile} self />
        {peer.status !== 'unknown' && (
          <>
            <span class="texte-second">{t.joueurs.et}</span>
            <PlayerName profile={peer.profile} self={false} />
          </>
        )}
      </span>
      <span class={`presence-etat presence-${peer.status}`}>
        <Icon name={peer.status === 'present' ? 'success' : 'warning'} />
        <span>
          <strong>
            {peer.status === 'present'
              ? t.presence.la(peer.profile.pseudo)
              : peer.status === 'absent'
                ? t.presence.absent(peer.profile.pseudo)
                : t.presence.personne}
          </strong>
          {peer.status === 'present' && (
            <span class="texte-second"> {t.presence.jouerEnsemble}</span>
          )}
        </span>
      </span>
    </div>
  );
}

function Home({ state, profile }: { state: AppState; profile: Profile }): JSX.Element {
  const invitation = state.invitation;
  // Focus par défaut: Héberger, ou Rejoindre si une invitation attend (UX 10).
  const hostButton = useInitialFocus<HTMLButtonElement>(
    invitation === null ? 'heberger' : 'rejoindre',
  );
  const name = peerName(state);
  return (
    <section class="accueil" data-testid="ecran-accueil">
      <PresenceCard state={state} profile={profile} />
      <div class="accueil-actions">
        <div class="carte carte-action">
          <h2 class="titre-3">
            <Icon name="host" /> {t.accueil.heberger}
          </h2>
          <p class="texte-second">{t.accueil.hebergerTexte(name)}</p>
          <button
            type="button"
            class={`bouton ${invitation === null ? 'bouton-principal' : 'bouton-secondaire'} bouton-grand`}
            ref={invitation === null ? hostButton : null}
            data-testid="accueil-heberger"
            onClick={() => {
              markScreenChange();
              tab.value = 'library';
            }}
          >
            {t.accueil.hebergerBouton}
          </button>
        </div>
        <div class="carte carte-action">
          <h2 class="titre-3">
            <Icon name="join" /> {t.accueil.rejoindre}
          </h2>
          {invitation === null ? (
            <p class="texte-second" data-testid="rejoindre-vide">
              {t.accueil.rejoindreVide(name)}
            </p>
          ) : (
            <>
              <p data-testid="rejoindre-salon">
                <strong>{t.accueil.salonTrouve(invitation.from.pseudo)}</strong>
                <span class="texte-second">
                  {' · '}
                  {invitation.game.name} ·{' '}
                  {invitation.save === null ? t.invitation.nouvellePartie : invitation.save.label}
                </span>
              </p>
              <button
                type="button"
                class="bouton bouton-principal bouton-grand"
                ref={hostButton}
                data-testid="accueil-rejoindre"
                disabled={gateReason(gateFor(invitation.game, state.updateCheck)) !== null}
                onClick={() => {
                  void send('salon:join', null);
                }}
              >
                {t.accueil.rejoindreBouton}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Library({ state }: { state: AppState }): JSX.Element {
  const first = useInitialFocus<HTMLButtonElement>('bibliotheque');
  useEffect(() => {
    void send('library:opened', null);
  }, []);
  const grid = useRef<HTMLDivElement>(null);
  useEscape(() => {
    markScreenChange();
    tab.value = 'home';
  });
  const name = peerName(state);
  const subtitle =
    state.peer.status === 'absent'
      ? t.bibliotheque.sousTitreAbsent(state.peer.profile.pseudo)
      : t.bibliotheque.sousTitre(name);
  const onArrow = (event: KeyboardEvent): void => {
    const items = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('.vignette') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    items[(index + delta + items.length) % items.length]?.focus();
  };
  return (
    <section class="bibliotheque" data-testid="ecran-bibliotheque">
      <h1 class="titre-1">{t.bibliotheque.titre}</h1>
      <p class="corps-grand texte-second">{subtitle}</p>
      {state.games.length === 0 ? (
        <p class="carte" data-testid="bibliotheque-vide">
          {t.bibliotheque.vide}
        </p>
      ) : (
        <div class="grille-jeux" ref={grid} onKeyDown={onArrow}>
          {state.games.map((game, index) => {
            const reason = gateReason(gateFor(game, state.updateCheck));
            return (
              <div key={game.id} class="vignette-cadre">
                <button
                  type="button"
                  class="vignette"
                  ref={index === 0 ? first : null}
                  data-testid={`jeu-${game.id}`}
                  aria-label={`${game.name}, ${gameDetail(game)}`}
                  disabled={reason !== null}
                  onClick={() => {
                    void send('salon:open', { gameId: game.id });
                  }}
                >
                  <img class="vignette-image" src={game.thumbnailUrl} alt="" aria-hidden="true" />
                  <span class="vignette-nom">{game.name}</span>
                  <span class="petit texte-second">{gameDetail(game)}</span>
                  <span class="petit texte-second vignette-description">{game.description}</span>
                </button>
                <UpdateBanner game={game} />
                {reason !== null && (
                  <p class="petit texte-second" data-testid={`raison-${game.id}`}>
                    {reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {state.updateCheck.kind === 'unreachable' && (
        <p class="petit texte-second" data-testid="maj-injoignable">
          {majTextes.injoignable}
        </p>
      )}
      <div class="bibliotheque-actions">
        {/* Recours sans Internet (ADR 0010, point 7): même vérification qu'un téléchargement. */}
        <button
          type="button"
          class="bouton bouton-secondaire"
          data-testid="installer-fichier"
          onClick={() => {
            void send('library:install-file', null);
          }}
        >
          {t.bibliotheque.installerFichier}
        </button>
      </div>
    </section>
  );
}

// Réglages (E16), réduits pour l'instant à l'affichage: la case suit l'état réel de la
// fenêtre, que le changement vienne d'ici, de F11 ou du menu de macOS.
function SettingsScreen({ state }: { state: AppState }): JSX.Element {
  const box = useInitialFocus<HTMLInputElement>('reglages');
  useEscape(() => {
    markScreenChange();
    tab.value = 'home';
  });
  const key = fullscreenKey(state.platform);
  return (
    <section class="reglages" data-testid="ecran-reglages">
      <h1 class="titre-1">{t.reglages.titre}</h1>
      <div class="carte">
        <h2 class="surtitre">{t.reglages.affichage}</h2>
        <label class="case-a-cocher">
          <input
            type="checkbox"
            ref={box}
            checked={state.fullscreen}
            aria-describedby="plein-ecran-aide"
            data-testid="reglages-plein-ecran"
            onChange={(event) => {
              void send('window:set-fullscreen', { fullscreen: event.currentTarget.checked });
            }}
          />
          <span>{t.reglages.pleinEcran}</span>
          <kbd class="touche">{key}</kbd>
        </label>
        <p id="plein-ecran-aide" class="petit texte-second">
          {t.reglages.pleinEcranAide(key)}
        </p>
      </div>
    </section>
  );
}

export function InvitationBanner({
  invitation,
  check,
}: {
  invitation: InvitationView;
  check: UpdateCheckView;
}): JSX.Element | null {
  const reason = gateReason(gateFor(invitation.game, check));
  const key = invitationKey(invitation);
  const join = useInitialFocus<HTMLButtonElement>(key);
  useEscape(
    dismissedInvitation.value === key
      ? null
      : () => {
          dismissedInvitation.value = key;
        },
  );
  if (dismissedInvitation.value === key) return null;
  const saveText =
    invitation.save === null
      ? t.invitation.nouvellePartie
      : `${invitation.save.label}, ${when(invitation.save.writtenAt)}`;
  return (
    <div
      class="bandeau-invitation panneau"
      role="dialog"
      aria-labelledby="invitation-titre"
      data-testid="invitation"
    >
      <PlayerSymbol color={invitation.from.color} size={48} />
      <div class="bandeau-texte">
        <h2 id="invitation-titre" class="titre-3">
          {t.invitation.titre(invitation.from.pseudo)}
        </h2>
        <p class="texte-second">
          {invitation.game.name} · {gameDetail(invitation.game)}
        </p>
        <p class="petit texte-second">{t.invitation.sauvegarde(saveText)}</p>
        <UpdateBanner game={invitation.game} />
        {reason !== null && (
          <p class="petit texte-second" data-testid="invitation-raison">
            {reason}
          </p>
        )}
      </div>
      <div class="bandeau-actions">
        <button
          type="button"
          class="bouton bouton-principal"
          ref={join}
          data-testid="invitation-rejoindre"
          disabled={reason !== null}
          onClick={() => {
            void send('salon:join', null);
          }}
        >
          {t.invitation.rejoindre}
        </button>
        <button
          type="button"
          class="bouton bouton-secondaire"
          data-testid="invitation-plus-tard"
          onClick={() => {
            dismissedInvitation.value = key;
          }}
        >
          {t.invitation.plusTard}
        </button>
      </div>
    </div>
  );
}

export function Launcher({ state, profile }: { state: AppState; profile: Profile }): JSX.Element {
  return (
    <div class="scene scene-ciel">
      <Sky />
      <TopBar state={state} profile={profile} />
      <main class="contenu">
        {tab.value === 'home' ? (
          <Home state={state} profile={profile} />
        ) : tab.value === 'library' ? (
          <Library state={state} />
        ) : (
          <SettingsScreen state={state} />
        )}
      </main>
      {state.invitation !== null && (
        <InvitationBanner invitation={state.invitation} check={state.updateCheck} />
      )}
    </div>
  );
}
