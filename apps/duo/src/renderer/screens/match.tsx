// Pendant une partie (UX sections 2 et 3): chargement (E09), indice « Échap :
// pause » (E10), superpositions de pause (E11) et de connexion perdue (E12).
// La vue plateforme est transparente: le jeu figé reste visible sous le voile.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { AppState, MatchView, Profile } from '../../shared/state';
import { send } from '../bridge';
import { clock, percent, t } from '../textes';
import { ActionList, Chip, Dialog, Icon, PlayerSymbol, useCountdown, useNow } from '../ui/components';
import { useEscape, useInitialFocus } from '../ui/keyboard';

function peerProfile(state: AppState): Profile | null {
  return state.peer.status === 'unknown' ? null : state.peer.profile;
}

function Loading({ state, match }: { state: AppState; match: MatchView }): JSX.Element {
  const now = useNow(true);
  const peer = peerProfile(state);
  const long = now - match.loadingSince > 20_000;
  return (
    <main class="scene scene-opaque ecran-centre" data-testid="ecran-chargement" aria-live="polite">
      <h1 class="titre-1">{t.chargement.titre(match.game.name)}</h1>
      <div class="attente-orbite">
        <span class="orbite" aria-hidden="true">
          <span class="orbite-astre" />
        </span>
        <span>
          {t.chargement.toi(percent(match.selfLoading))}
          {peer !== null && match.peerLoading !== null && ` · ${t.chargement.autre(peer.pseudo, percent(match.peerLoading))}`}
        </span>
      </div>
      {long && peer !== null && <p class="texte-second">{t.chargement.long(peer.pseudo)}</p>}
      <div class="carte">
        <h2 class="surtitre">{t.salon.commandes}</h2>
        <ActionList actions={match.game.actions} />
      </div>
    </main>
  );
}

function Hint(): JSX.Element {
  return (
    <div class="indice-partie" data-testid="indice-pause">
      <span class="capsule-indice">
        <Icon name="pause" size="small" />
        {t.partie.indice}
      </span>
    </div>
  );
}

function StopDialog({ match, onBack, waiting }: { match: MatchView; onBack: () => void; waiting: boolean }): JSX.Element {
  const text = match.game.saves?.help ?? t.arret.texteParDefaut;
  return (
    <Dialog
      title={t.arret.titre}
      action={{
        label: t.arret.action,
        testId: 'arret-confirmer',
        onClick: () => {
          onBack();
          void send('match:stop', null);
        },
      }}
      back={{ label: waiting ? t.arret.continuerAttendre : t.arret.continuer, testId: 'arret-retour', onClick: onBack }}
      focusBack
    >
      <p>{text}</p>
    </Dialog>
  );
}

function PauseOverlay({ state, match, profile }: { state: AppState; match: MatchView; profile: Profile }): JSX.Element {
  const peer = peerProfile(state);
  const [panel, setPanel] = useState<'menu' | 'commands'>('menu');
  const [confirmStop, setConfirmStop] = useState(false);
  const seconds = useCountdown(match.phase === 'resuming' ? match.resumeEndsAt : null);
  const resume = useInitialFocus<HTMLButtonElement>(`${panel}:${match.phase}`);
  const back = useInitialFocus<HTMLButtonElement>(panel);

  useEscape(
    confirmStop
      ? null
      : panel === 'commands'
        ? () => {
            setPanel('menu');
          }
        : match.phase === 'resuming'
          ? () => {
              void send('match:pause', null);
            }
          : () => {
              void send('match:resume', null);
            },
  );

  const subtitle = match.peerBack && peer !== null
    ? t.pause.retourAutre(peer.pseudo)
    : match.pausedBy.self && match.pausedBy.peer && peer !== null
      ? t.pause.parDeux(profile.pseudo, peer.pseudo)
      : match.pausedBy.peer && peer !== null
        ? t.pause.parAutre(peer.pseudo)
        : match.pausedBy.self
          ? t.pause.parToi
          : '';

  const chip = (wants: boolean): JSX.Element =>
    wants ? <Chip kind="wants-resume" label={t.pause.puces.veutReprendre} /> : <Chip kind="paused" label={t.pause.puces.enPause} />;

  return (
    <div class="voile superposition" data-testid="superposition-pause">
      <div class="panneau panneau-pause" role="dialog" aria-labelledby="pause-titre">
        {panel === 'menu' ? (
          <>
            <h1 id="pause-titre" class="titre-2">
              <Icon name="pause" /> {t.pause.titre}
            </h1>
            {subtitle !== '' && <p class="texte-second">{subtitle}</p>}
            {seconds !== null ? (
              <p class="reprise" role="status" data-testid="reprise-decompte">
                {t.pause.reprise(seconds)}
              </p>
            ) : (
              <div class="menu-pause">
                <button
                  type="button"
                  class={`bouton ${match.resumeReady.self ? 'bouton-secondaire' : 'bouton-principal'}`}
                  ref={resume}
                  disabled={match.resumeReady.self}
                  data-testid="pause-reprendre"
                  onClick={() => {
                    void send('match:resume', null);
                  }}
                >
                  <Icon name="resume" /> {t.pause.reprendre}
                </button>
                <button
                  type="button"
                  class="bouton bouton-secondaire"
                  data-testid="pause-commandes"
                  onClick={() => {
                    setPanel('commands');
                  }}
                >
                  <Icon name="keyboard" /> {t.pause.commandes}
                </button>
                <button
                  type="button"
                  class="bouton bouton-secondaire"
                  data-testid="pause-retour-salon"
                  onClick={() => {
                    setConfirmStop(true);
                  }}
                >
                  <Icon name="back" /> {t.pause.retourSalon}
                </button>
              </div>
            )}
            <div class="paire-puces">
              <span class="joueur-puce">
                <PlayerSymbol color={profile.color} /> {profile.pseudo} {chip(match.resumeReady.self)}
              </span>
              {peer !== null && (
                <span class="joueur-puce">
                  <PlayerSymbol color={peer.color} /> {peer.pseudo} {chip(match.resumeReady.peer)}
                </span>
              )}
            </div>
            <p class="petit texte-second">{t.pause.aide}</p>
          </>
        ) : (
          <>
            <h1 id="pause-titre" class="titre-2">
              <Icon name="keyboard" /> {t.pause.commandes}
            </h1>
            <ActionList actions={match.game.actions} />
            <button
              type="button"
              class="bouton bouton-secondaire"
              ref={back}
              data-testid="commandes-retour"
              onClick={() => {
                setPanel('menu');
              }}
            >
              {t.pause.retourCommandes}
            </button>
          </>
        )}
      </div>
      {confirmStop && (
        <StopDialog
          match={match}
          waiting={false}
          onBack={() => {
            setConfirmStop(false);
          }}
        />
      )}
    </div>
  );
}

function LinkLostOverlay({ state, match }: { state: AppState; match: MatchView }): JSX.Element {
  const peer = peerProfile(state);
  const name = peer?.pseudo ?? '';
  const now = useNow(true);
  const [confirmStop, setConfirmStop] = useState(false);
  const stop = useInitialFocus<HTMLButtonElement>('coupure');
  const since = match.linkLostSince ?? now;
  const elapsed = now - since;
  return (
    <div class="voile superposition" data-testid="superposition-coupure" data-message="M-17">
      <div class="panneau panneau-pause" role="dialog" aria-labelledby="coupure-titre">
        <h1 id="coupure-titre" class="titre-2">
          <Icon name="warning" /> {t.coupure.titre(name)}
        </h1>
        <p>{t.coupure.texte(name)}</p>
        <p class="texte-second" role="status">
          {t.coupure.statut(clock(elapsed))}
        </p>
        {elapsed >= 30_000 && <p class="texte-second">{t.coupure.apres30s(name)}</p>}
        {elapsed >= 60_000 && (match.game.saves?.help ?? null) !== null && <p class="texte-second">{match.game.saves?.help}</p>}
        <button
          type="button"
          class="bouton bouton-secondaire"
          ref={stop}
          data-testid="coupure-arreter"
          onClick={() => {
            setConfirmStop(true);
          }}
        >
          {t.coupure.arreter}
        </button>
      </div>
      {confirmStop && (
        <StopDialog
          match={match}
          waiting
          onBack={() => {
            setConfirmStop(false);
          }}
        />
      )}
    </div>
  );
}

export function MatchLayer({ state, match, profile }: { state: AppState; match: MatchView; profile: Profile }): JSX.Element | null {
  const now = useNow(match.hintUntil !== null);
  switch (match.phase) {
    case 'loading':
      return <Loading state={state} match={match} />;
    case 'playing':
      return match.hintUntil !== null && now < match.hintUntil ? <Hint /> : null;
    case 'paused':
    case 'resuming':
      return <PauseOverlay state={state} match={match} profile={profile} />;
    case 'link-lost':
      return <LinkLostOverlay state={state} match={match} />;
  }
}
