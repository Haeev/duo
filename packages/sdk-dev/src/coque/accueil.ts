// Mode « réseau local »: page d'accueil servie par `servir`. Chaque navigateur choisit son profil,
// puis l'un héberge et l'autre rejoint; le jeu s'ouvre en plein écran avec les écrans du faux hôte.
import {
  PLAYER_COLOR_IDS,
  PLAYER_COLORS,
  type GameManifest,
  type PlayerColorId,
} from '@duo/protocol';
import * as v from 'valibot';
import { createFakePlatform, DEFAULT_SETTINGS, randomId } from '../coeur/plateforme';
import { ProfileSchema, type Profile } from '../coeur/pair';
import type { SlotSummary } from '../coeur/stockage';
import { createWebSocketLink } from './lien-ws';
import { loadManifest, showFatal } from './manifeste';
import { createHttpStore } from './stockages';
import { mountGameView, resumeOnEscape } from './vue';

const GAME_URL = '/jeu/';
const PROFILE_KEY = 'duo-sdk-dev:profil';
const SETTINGS_KEY = 'duo-sdk-dev:volumes';

const ServerInfoSchema = v.object({
  addresses: v.array(v.string()),
  port: v.number(),
  hostPresent: v.boolean(),
});

const app = document.getElementById('app') ?? document.body;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

function readProfile(): Profile | null {
  try {
    const result = v.safeParse(
      ProfileSchema,
      JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null'),
    );
    return result.success ? result.output : null;
  } catch {
    return null;
  }
}

function readVolumes(): typeof DEFAULT_SETTINGS {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    const result = v.safeParse(
      v.object({
        master: v.number(),
        music: v.number(),
        effects: v.number(),
        interface: v.number(),
      }),
      raw,
    );
    return result.success ? { ...DEFAULT_SETTINGS, volumes: result.output } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('fr-FR', {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'long',
      });
}

function startGame(
  manifest: GameManifest,
  profile: Profile,
  role: 'host' | 'guest',
  resume: boolean,
): void {
  document.body.replaceChildren();
  const views = el('div', undefined, 'vues une');
  document.body.append(views);
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const link = createWebSocketLink(`${protocol}//${location.host}/relais?role=${role}`);
  const store = createHttpStore();
  const view = mountGameView({
    container: views,
    gameUrl: GAME_URL,
    settings: readVolumes(),
    onSettings: (settings) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.volumes));
    },
    onExit: () => {
      link.close();
      location.reload();
    },
    createPlatform: (hooks) =>
      createFakePlatform({
        role,
        manifest,
        profile,
        link,
        resume,
        slot: 1,
        settings: readVolumes(),
        ...(role === 'host' ? { store } : {}),
        ...hooks,
      }),
  });
  resumeOnEscape([view]);
  view.iframe.focus();
}

async function main(): Promise<void> {
  const manifest = await loadManifest(GAME_URL);
  const infoResponse = await fetch('/api/serveur');
  const info = v.parse(ServerInfoSchema, await infoResponse.json());
  const saves: SlotSummary[] =
    manifest.saves === null ? [] : await createHttpStore().list(manifest.id);

  const page = el('div', undefined, 'accueil');
  page.append(el('h1', manifest.name), el('p', manifest.description));

  // Profil de ce navigateur.
  const stored = readProfile();
  const profileBox = el('fieldset');
  profileBox.append(el('legend', 'Ton profil'));
  const nameLabel = el('label', 'Ton pseudo');
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.maxLength = 16;
  nameInput.value = stored?.name ?? '';
  nameInput.autocomplete = 'off';
  nameLabel.append(nameInput);
  const colors = el('div', undefined, 'couleurs');
  let chosen: PlayerColorId = stored?.color ?? 'orb';
  for (const id of PLAYER_COLOR_IDS) {
    const label = el('label');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'couleur';
    radio.value = id;
    radio.checked = id === chosen;
    radio.addEventListener('change', () => {
      chosen = id;
    });
    const dot = el('span', undefined, 'pastille');
    dot.style.background = PLAYER_COLORS[id].hex;
    label.append(radio, dot, document.createTextNode(PLAYER_COLORS[id].label));
    colors.append(label);
  }
  profileBox.append(nameLabel, el('p', 'Ta couleur'), colors);

  const message = el('p', undefined, 'erreur');
  const profileOrError = (): Profile | null => {
    const name = nameInput.value.trim().normalize('NFC');
    if (name.length === 0) {
      message.textContent = 'Choisis d’abord un pseudo.';
      nameInput.focus();
      return null;
    }
    const profile: Profile = { id: stored?.id ?? randomId(), name, color: chosen };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  };

  // Héberger ou rejoindre.
  const play = el('fieldset');
  play.append(el('legend', 'Jouer'));
  const lastSave = saves[0];
  const buttons = el('div', undefined, 'boutons');
  const addButton = (text: string, primary: boolean, onClick: () => void): void => {
    const b = el('button', text, primary ? 'bouton principal' : 'bouton');
    b.type = 'button';
    b.addEventListener('click', onClick);
    buttons.append(b);
  };
  if (info.hostPresent) {
    play.append(el('p', 'Une partie est hébergée: rejoins-la.'));
    addButton('Rejoindre', true, () => {
      const profile = profileOrError();
      if (profile !== null) startGame(manifest, profile, 'guest', false);
    });
  } else {
    if (lastSave !== undefined) {
      play.append(
        el('p', `Dernière sauvegarde: ${lastSave.label}, ${formatDate(lastSave.savedAt)}.`),
      );
      addButton('Héberger et continuer', true, () => {
        const profile = profileOrError();
        if (profile !== null) startGame(manifest, profile, 'host', true);
      });
      addButton('Héberger une nouvelle partie', false, () => {
        const profile = profileOrError();
        if (profile === null) return;
        if (
          confirm(
            `La nouvelle partie remplacera « ${lastSave.label} » à sa première sauvegarde. Continuer ?`,
          )
        ) {
          startGame(manifest, profile, 'host', false);
        }
      });
    } else {
      addButton('Héberger', true, () => {
        const profile = profileOrError();
        if (profile !== null) startGame(manifest, profile, 'host', false);
      });
    }
    addButton('Rejoindre', false, () => {
      const profile = profileOrError();
      if (profile !== null) startGame(manifest, profile, 'guest', false);
    });
  }
  play.append(buttons, message);

  const addresses = el('fieldset');
  addresses.append(
    el('legend', 'Sur l’autre ordinateur'),
    el('p', 'Ouvre cette adresse dans le navigateur (Chrome ou Edge):'),
  );
  for (const address of info.addresses) {
    addresses.append(el('p', `http://${address}:${info.port}/`, 'adresse'));
  }
  if (info.addresses.length === 0)
    addresses.append(el('p', 'Aucune adresse sur le réseau local trouvée.'));

  page.append(profileBox, play, addresses);
  app.replaceChildren(page);
}

main().catch((error: unknown) => {
  showFatal(app, String(error instanceof Error ? error.message : error));
});
