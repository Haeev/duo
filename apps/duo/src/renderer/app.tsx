// Choix de l'écran (ADR 0012, point 2): l'état du principal décide, sans routeur.
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { AppState, EndView, NoticeView, Profile } from '../shared/state';
import { appState, send } from './bridge';
import { FirstLaunch } from './screens/first-launch';
import { Launcher } from './screens/home';
import { MatchLayer } from './screens/match';
import { Salon } from './screens/salon';
import { playedDuration, t } from './textes';
import { Dialog, IconSprite, PlayerCard, Sky, Toasts } from './ui/components';
import { installKeyboardGuards, useEscape, useInitialFocus } from './ui/keyboard';

installKeyboardGuards();

function endTitle(end: EndView): string {
  switch (end.outcome) {
    case 'won':
      return t.fin.gagne;
    case 'lost':
      return end.winner === null ? t.fin.titrePartie : t.fin.gagnePar(end.winner);
    case 'draw':
      return t.fin.egalite;
    case 'success':
      return t.fin.reussite;
    case 'failure':
      return t.fin.echec;
    case null:
      return end.kind === 'session' ? t.fin.titreSeance : t.fin.titrePartie;
  }
}

function EndScreen({ end, state, profile }: { end: EndView; state: AppState; profile: Profile }): JSX.Element {
  const button = useInitialFocus<HTMLButtonElement>('fin');
  const dismiss = (): void => {
    void send('end:dismiss', null);
  };
  useEscape(dismiss);
  const peer = state.peer.status === 'unknown' ? null : state.peer.profile;
  return (
    <main class="scene scene-ciel ecran-centre" data-testid="ecran-fin">
      <Sky />
      <h1 class="display">{endTitle(end)}</h1>
      <p class="corps-grand texte-second">{t.fin.sousTitre(end.game.name, playedDuration(end.durationMs))}</p>
      <div class="paire-joueurs">
        <PlayerCard profile={profile} self testId="fin-carte-toi" />
        {peer !== null && <PlayerCard profile={peer} self={false} testId="fin-carte-autre" />}
      </div>
      {end.stats.length > 0 && (
        <dl class="statistiques" data-testid="fin-statistiques">
          {end.stats.map((stat) => (
            <div class="statistique" key={stat.label}>
              <dt class="petit texte-second">{stat.label}</dt>
              <dd class="chiffre">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {end.saved && <p class="texte-succes">{t.fin.progression}</p>}
      <button type="button" class="bouton bouton-principal bouton-grand" ref={button} data-testid="fin-retour-salon" onClick={dismiss}>
        {t.fin.retourSalon}
      </button>
    </main>
  );
}

function NoticeDialog({ notice, state }: { notice: NoticeView; state: AppState }): JSX.Element {
  const peerName = state.peer.status === 'unknown' ? null : state.peer.profile.pseudo;
  const dismiss = (): void => {
    void send('notice:dismiss', null);
  };
  return (
    <Dialog
      title={t.arretJeu.titre}
      message="M-14"
      back={{ label: t.arretJeu.compris, testId: 'arret-jeu-compris', onClick: dismiss }}
    >
      {notice.kind === 'game-crashed' ? (
        <>
          <p>{t.arretJeu.texte(notice.gameName)}</p>
          {notice.hadSave && <p class="texte-second">{t.arretJeu.sauvegardeIntacte}</p>}
        </>
      ) : (
        <p>{t.arretJeu.echecChargement(notice.gameName, notice.where === 'peer' ? peerName : null)}</p>
      )}
    </Dialog>
  );
}

function QuitDialog(): JSX.Element {
  return (
    <Dialog
      title={t.quitter.titre}
      message="M-15"
      action={{
        label: t.quitter.action,
        testId: 'quitter-confirmer',
        onClick: () => {
          void send('app:quit-confirm', null);
        },
      }}
      back={{
        label: t.quitter.continuer,
        testId: 'quitter-retour',
        onClick: () => {
          void send('app:quit-cancel', null);
        },
      }}
      focusBack
    >
      <p>{t.quitter.texte}</p>
    </Dialog>
  );
}

function Scene({ state }: { state: AppState }): JSX.Element | null {
  const profile = state.profile;
  if (profile === null || !state.setup.done) return <FirstLaunch state={state} />;
  if (state.match !== null) return <MatchLayer state={state} match={state.match} profile={profile} />;
  if (state.end !== null) return <EndScreen end={state.end} state={state} profile={profile} />;
  if (state.salon !== null) return <Salon state={state} salon={state.salon} profile={profile} />;
  return <Launcher state={state} profile={profile} />;
}

function useRootAttributes(state: AppState | null): void {
  useEffect(() => {
    const root = document.documentElement;
    const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reduced = state?.settings.reducedMotion ?? systemReduced;
    root.dataset.motion = reduced ? 'reduced' : 'normal';
    root.style.fontSize = `${16 * (state?.settings.uiScale ?? 1)}px`;
    const inMatch = state?.match !== null && state?.match !== undefined && state.match.phase !== 'loading';
    root.dataset.scene = inMatch ? 'partie' : 'lanceur';
    root.dataset.platform = state?.platform ?? 'linux';
  }, [state]);
}

export function App(): JSX.Element | null {
  const state = appState.value;
  useRootAttributes(state);
  if (state === null) return null;
  return (
    <>
      <IconSprite />
      <Scene state={state} />
      {state.notice !== null && <NoticeDialog notice={state.notice} state={state} />}
      {state.quitConfirm && <QuitDialog />}
      <Toasts toasts={state.toasts} />
    </>
  );
}
