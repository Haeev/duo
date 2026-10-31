// Parcours 1: premier lancement (E01 à E04, UX section 1).
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { PLAYER_COLORS, type PlayerColor } from '../../shared/players';
import { checkPseudo, filterPseudoInput, graphemes } from '../../shared/pseudo';
import type { AppState, Profile } from '../../shared/state';
import { send } from '../bridge';
import { t } from '../textes';
import { ColorPicker, Icon, PlayerCard, PlayerSymbol, Sky } from '../ui/components';
import { useEscape, useInitialFocus } from '../ui/keyboard';

type Step = 'welcome' | 'profile' | 'network' | 'peer';

const step = signal<Step | null>(null);

function initialStep(state: AppState): Step {
  if (state.profile === null) return 'welcome';
  if (!state.setup.networkAccepted) return 'network';
  return 'peer';
}

function Steps({ current }: { current: 1 | 2 | 3 }): JSX.Element {
  return (
    <p class="etapes surtitre" aria-label={t.etapes.lecteur(current)}>
      {t.etapes.liste}
    </p>
  );
}

function Welcome(): JSX.Element {
  const button = useInitialFocus<HTMLButtonElement>();
  return (
    <section class="ecran-centre" data-testid="ecran-bienvenue">
      <h1 class="display">{t.bienvenue.titre}</h1>
      <p class="corps-grand">{t.bienvenue.texte1}</p>
      <p class="corps-grand texte-second">{t.bienvenue.texte2}</p>
      <button
        type="button"
        class="bouton bouton-principal bouton-grand"
        ref={button}
        data-testid="bienvenue-commencer"
        onClick={() => {
          step.value = 'profile';
        }}
      >
        {t.bienvenue.commencer}
      </button>
    </section>
  );
}

function ProfileStep({ state }: { state: AppState }): JSX.Element {
  const [pseudo, setPseudo] = useState(state.profile?.pseudo ?? '');
  const [color, setColor] = useState<PlayerColor>(
    () =>
      state.profile?.color ??
      PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)] ??
      'orb',
  );
  const [error, setError] = useState<'empty' | 'character' | null>(null);
  const input = useInitialFocus<HTMLInputElement>();
  useEscape(() => {
    step.value = 'welcome';
  });
  useEffect(() => {
    input.current?.select();
  }, [input]);

  const submit = (): void => {
    const check = checkPseudo(pseudo);
    if (!check.ok) {
      setError(check.reason === 'empty' ? 'empty' : 'character');
      input.current?.focus();
      return;
    }
    void send('profile:save', { pseudo: check.value, color }).then((result) => {
      if (result.ok) step.value = 'network';
    });
  };

  return (
    <section class="ecran-centre ecran-formulaire" data-testid="ecran-profil">
      <Steps current={1} />
      <h1 class="titre-1">{t.profil.titre}</h1>
      <form
        class="formulaire"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label class="champ">
          <span class="libelle">{t.profil.champ}</span>
          <input
            ref={input}
            class={`saisie${error === null ? '' : ' saisie-erreur'}`}
            type="text"
            value={pseudo}
            maxLength={64}
            autoComplete="off"
            spellcheck={false}
            aria-describedby="pseudo-aide pseudo-erreur"
            aria-invalid={error !== null}
            data-testid="profil-pseudo"
            onInput={(event) => {
              const filtered = filterPseudoInput(event.currentTarget.value);
              if (filtered.value !== event.currentTarget.value)
                event.currentTarget.value = filtered.value;
              setPseudo(filtered.value);
              setError(filtered.rejected ? 'character' : null);
            }}
          />
          <span id="pseudo-aide" class="petit texte-second">
            {t.profil.aide} {t.profil.compteur(graphemes(pseudo.trim()).length)}
          </span>
          {error !== null && (
            <span id="pseudo-erreur" class="petit texte-erreur" data-message="M-01" role="alert">
              <Icon name="error" size="small" />
              {error === 'empty' ? t.profil.erreurVide : t.profil.erreurCaractere}
            </span>
          )}
        </label>
        <div class="champ">
          <span class="libelle" id="couleur-libelle">
            {t.profil.groupe}
          </span>
          <ColorPicker value={color} onChange={setColor} taken={null} labelId="couleur-libelle" />
          <span class="petit texte-second">{t.profil.aideCouleur}</span>
        </div>
        <p class="apercu">
          {t.profil.apercu} <PlayerSymbol color={color} />{' '}
          <strong>{pseudo.trim() === '' ? '…' : pseudo.trim()}</strong>
        </p>
        <div class="actions">
          <button
            type="button"
            class="bouton bouton-secondaire"
            data-testid="profil-retour"
            onClick={() => {
              step.value = 'welcome';
            }}
          >
            {t.profil.retour}
          </button>
          <button type="submit" class="bouton bouton-principal" data-testid="profil-continuer">
            {t.profil.continuer}
          </button>
        </div>
      </form>
    </section>
  );
}

function NetworkStep({ state }: { state: AppState }): JSX.Element {
  const button = useInitialFocus<HTMLButtonElement>();
  const [waiting, setWaiting] = useState(false);
  const texts = state.platform === 'win32' ? t.reseau.windows : t.reseau.macos;
  useEscape(() => {
    step.value = 'profile';
  });
  const accept = (): void => {
    setWaiting(true);
    void send('setup:network-accept', null).then(() => {
      step.value = 'peer';
    });
  };
  return (
    <section class="ecran-centre ecran-formulaire" data-testid="ecran-reseau">
      <Steps current={2} />
      <h1 class="titre-1">{texts.titre}</h1>
      <p class="corps-grand">{texts.texte}</p>
      <div class="carte consigne">
        <p>{texts.consigne[0]}</p>
        {texts.consigne.length > 1 && (
          <ol>
            {texts.consigne.slice(1).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        )}
      </div>
      <p class="texte-second">{t.reseau.rassurer}</p>
      {waiting && <p class="texte-second">{texts.attente}</p>}
      <div class="actions">
        <button
          type="button"
          class="bouton bouton-secondaire"
          data-testid="reseau-retour"
          onClick={() => {
            step.value = 'profile';
          }}
        >
          {t.reseau.retour}
        </button>
        <button
          type="button"
          class="bouton bouton-principal"
          ref={button}
          data-testid="reseau-continuer"
          onClick={accept}
        >
          {t.reseau.continuer}
        </button>
      </div>
      {/* « Passer cette étape » (E03) reviendra avec Réglages > Réseau: sans cet écran, ne
          pas donner l'accord laisserait Duo sans connexion, sans moyen de le donner plus tard. */}
    </section>
  );
}

function PeerStep({ state, profile }: { state: AppState; profile: Profile }): JSX.Element {
  const peer = state.peer.status === 'present' ? state.peer.profile : null;
  const [elapsed, setElapsed] = useState(0);
  const finish = useInitialFocus<HTMLButtonElement>(peer === null ? 'recherche' : 'trouve');
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const complete = (): void => {
    void send('setup:complete', null);
  };
  const sameColor = peer !== null && peer.color === profile.color;

  if (peer === null) {
    return (
      <section class="ecran-centre" data-testid="ecran-recherche">
        <Steps current={3} />
        <h1 class="titre-1">{t.recherche.titre}</h1>
        <p class="corps-grand">{t.recherche.texte}</p>
        <div class="attente-orbite" role="status">
          <span class="orbite" aria-hidden="true">
            <span class="orbite-astre" />
          </span>
          <span>{t.recherche.etat}</span>
        </div>
        {elapsed >= 30 && (
          <p class="texte-second" data-message="M-08">
            {t.recherche.apres30s}
          </p>
        )}
        <p class="lien-aide">
          <button
            type="button"
            class="lien"
            ref={finish}
            data-testid="recherche-terminer-sans"
            onClick={complete}
          >
            {t.recherche.terminerSans}
          </button>
          <span class="petit texte-second">{t.recherche.aideTerminerSans}</span>
        </p>
      </section>
    );
  }

  return (
    <section class="ecran-centre" data-testid="ecran-trouve">
      <Steps current={3} />
      <h1 class="titre-1">{t.recherche.trouveTitre(peer.pseudo)}</h1>
      <p class="corps-grand">{t.recherche.trouveTexte}</p>
      <div class="paire-joueurs">
        <PlayerCard profile={profile} self testId="carte-toi" />
        <PlayerCard profile={peer} self={false} testId="carte-autre" />
      </div>
      {sameColor && (
        <div class="champ" data-message="M-02">
          <span class="libelle" id="couleur-prise">
            {t.recherche.memeCouleur(peer.pseudo)}
          </span>
          <ColorPicker
            value={profile.color}
            taken={{ color: peer.color, by: peer.pseudo }}
            labelId="couleur-prise"
            onChange={(color) => {
              void send('profile:save', { pseudo: profile.pseudo, color });
            }}
          />
        </div>
      )}
      <button
        type="button"
        class="bouton bouton-principal bouton-grand"
        ref={finish}
        disabled={sameColor}
        data-testid="trouve-terminer"
        onClick={complete}
      >
        {t.recherche.terminer}
      </button>
    </section>
  );
}

export function FirstLaunch({ state }: { state: AppState }): JSX.Element {
  const current = step.value ?? initialStep(state);
  let content: JSX.Element;
  switch (current) {
    case 'welcome':
      content = <Welcome />;
      break;
    case 'profile':
      content = <ProfileStep state={state} />;
      break;
    case 'network':
      content = <NetworkStep state={state} />;
      break;
    case 'peer':
      content =
        state.profile === null ? (
          <ProfileStep state={state} />
        ) : (
          <PeerStep state={state} profile={state.profile} />
        );
      break;
  }
  return (
    <main class="scene scene-ciel">
      <Sky />
      {content}
    </main>
  );
}
