// Mode « deux vues locales »: hôte et invité côte à côte, reliés par un relais local à latence réglable.
// Paramètres d'adresse: jeu (page du jeu, /jeu/ par défaut), latence, gigue, pertes (%), hote, invite.
import { PLAYER_COLOR_IDS, type PlayerColorId } from '@duo/protocol';
import { createLocalLinkPair } from '../coeur/lien';
import { createFakePlatform, DEFAULT_SETTINGS } from '../coeur/plateforme';
import { loadManifest, showFatal } from './manifeste';
import { createLocalStorageStore } from './stockages';
import { mountGameView, resumeOnEscape, type GameView } from './vue';

declare global {
  interface Window {
    /** Accès des tests Playwright aux deux vues. */
    __duoDeuxVues?: { readonly views: readonly GameView[] };
  }
}

const params = new URLSearchParams(location.search);
const gameUrl = params.get('jeu') ?? '/jeu/';
const numberParam = (name: string, fallback: number): number => {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) && value >= 0 ? value : fallback;
};
const colorParam = (name: string, fallback: PlayerColorId): PlayerColorId => {
  const value = params.get(name);
  return PLAYER_COLOR_IDS.find((id) => id === value) ?? fallback;
};

const bar = document.getElementById('barre');
const viewsRoot = document.getElementById('vues');

async function main(): Promise<void> {
  if (bar === null || viewsRoot === null) return;
  const manifest = await loadManifest(gameUrl);
  const pair = createLocalLinkPair({
    latencyMs: numberParam('latence', 30),
    jitterMs: numberParam('gigue', 5),
    spikeProbability: numberParam('pertes', 0) / 100,
  });
  const store = createLocalStorageStore();

  const numberInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
  ): HTMLLabelElement => {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = String(value);
    input.addEventListener('change', () => {
      const parsed = Number(input.value);
      if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
    });
    wrapper.append(input);
    return wrapper;
  };
  const title = document.createElement('span');
  title.className = 'titre';
  title.textContent = `${manifest.name} ${manifest.version}: deux vues locales`;
  const restart = document.createElement('button');
  restart.className = 'bouton';
  restart.type = 'button';
  restart.textContent = 'Recommencer';
  restart.addEventListener('click', () => {
    location.reload();
  });
  const wipe = document.createElement('button');
  wipe.className = 'bouton';
  wipe.type = 'button';
  wipe.textContent = 'Effacer les sauvegardes';
  wipe.addEventListener('click', () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`duo-sdk-dev:${manifest.id}:`)) localStorage.removeItem(key);
    }
    location.reload();
  });
  bar.append(
    title,
    numberInput('Latence (ms)', pair.conditions.latencyMs, (v) => {
      pair.conditions.latencyMs = v;
    }),
    numberInput('Gigue (ms)', pair.conditions.jitterMs, (v) => {
      pair.conditions.jitterMs = v;
    }),
    numberInput('Réémissions (%)', pair.conditions.spikeProbability * 100, (v) => {
      pair.conditions.spikeProbability = Math.min(1, v / 100);
    }),
    restart,
    wipe,
  );

  const hostName = params.get('hote') ?? 'Alex';
  const guestName = params.get('invite') ?? 'Sacha';
  const exit = (): void => {
    location.reload();
  };
  const host = mountGameView({
    container: viewsRoot,
    gameUrl,
    title: `Hôte: ${hostName}`,
    settings: DEFAULT_SETTINGS,
    onExit: exit,
    createPlatform: (hooks) =>
      createFakePlatform({
        role: 'host',
        manifest,
        profile: { id: 'membre-hote', name: hostName, color: colorParam('couleur-hote', 'orb') },
        link: pair.host,
        store,
        slot: 1,
        ...hooks,
      }),
  });
  const guest = mountGameView({
    container: viewsRoot,
    gameUrl,
    title: `Invité: ${guestName}`,
    settings: DEFAULT_SETTINGS,
    onExit: exit,
    createPlatform: (hooks) =>
      createFakePlatform({
        role: 'guest',
        manifest,
        profile: {
          id: 'membre-invite',
          name: guestName,
          color: colorParam('couleur-invite', 'crescent'),
        },
        link: pair.guest,
        ...hooks,
      }),
  });
  resumeOnEscape([host, guest]);
  window.__duoDeuxVues = { views: [host, guest] };
}

main().catch((error: unknown) => {
  showFatal(viewsRoot ?? document.body, String(error instanceof Error ? error.message : error));
});
