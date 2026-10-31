// Une vue de jeu du faux hôte: le jeu dans un cadre, sa fausse plateforme, et les écrans de la plateforme par-dessus.
import {
  BRIDGE_PORT_MESSAGE,
  BRIDGE_PORT_REQUEST,
  BRIDGE_VERSION,
  type GameSettings,
} from '@duo/protocol';
import type { FakePlatform, PlatformLogEntry, PlatformStatus } from '../coeur/plateforme';

export interface GameViewOptions {
  readonly container: HTMLElement;
  /** Adresse de la page d'entrée du jeu. */
  readonly gameUrl: string;
  /** Titre de la vue (« Hôte: Alex »), affiché au-dessus du jeu; aucun si absent. */
  readonly title?: string;
  readonly createPlatform: (hooks: {
    onStatus: (status: PlatformStatus) => void;
    onLog: (entry: PlatformLogEntry) => void;
  }) => FakePlatform;
  /** Bouton « Retour à l'accueil » des écrans de fin et d'erreur. */
  readonly onExit: () => void;
  readonly settings: GameSettings;
  readonly onSettings?: (settings: GameSettings) => void;
}

export interface GameView {
  readonly platform: FakePlatform;
  readonly iframe: HTMLIFrameElement;
  readonly logs: PlatformLogEntry[];
  status(): PlatformStatus;
}

const VOLUME_LABELS: readonly [keyof GameSettings['volumes'], string][] = [
  ['master', 'Volume général'],
  ['music', 'Musique'],
  ['effects', 'Effets'],
  ['interface', 'Interface'],
];

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.className !== undefined) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  el.append(...children);
  return el;
}

function button(text: string, onClick: () => void, primary = false): HTMLButtonElement {
  const el = element('button', { className: primary ? 'bouton principal' : 'bouton', text });
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}

export function mountGameView(options: GameViewOptions): GameView {
  const logs: PlatformLogEntry[] = [];
  let settings = options.settings;
  let current: PlatformStatus = { kind: 'waiting-peer' };

  const frame = element('div', { className: 'vue' });
  frame.dataset.statut = current.kind;
  if (options.title !== undefined)
    frame.append(element('div', { className: 'vue-titre', text: options.title }));
  const stage = element('div', { className: 'vue-scene' });
  const iframe = element('iframe');
  iframe.title = 'Jeu';
  // keyboard-map: libellés des touches selon la disposition (contexte sécurisé seulement).
  iframe.allow = 'autoplay; keyboard-map; fullscreen';
  const overlay = element('div', { className: 'voile' });
  stage.append(iframe, overlay);
  frame.append(stage);
  options.container.append(frame);

  const players = (): string => {
    const list = platform.players();
    if (list === null) return '';
    return list.map((p) => `${p.name} (${p.role === 'host' ? 'hôte' : 'invité'})`).join(' et ');
  };

  const nameOf = (id: string | null): string =>
    platform.players()?.find((p) => p.id === id)?.name ?? 'quelqu’un';

  const render = (): void => {
    overlay.replaceChildren();
    const panel = element('div', { className: 'panneau' });
    switch (current.kind) {
      case 'waiting-peer':
        panel.append(element('p', { text: 'En attente de l’autre joueur…' }));
        break;
      case 'loading':
        panel.append(element('p', { text: `Chargement ${Math.round(current.progress * 100)} %` }));
        break;
      case 'waiting-start':
        panel.append(element('p', { text: 'Prêt. On attend l’autre joueur.' }));
        break;
      case 'running':
        overlay.hidden = true;
        return;
      case 'paused': {
        panel.append(
          element('h2', { text: 'Pause' }),
          element('p', { text: `Demandée par ${nameOf(current.by)}. ${players()}` }),
        );
        const sliders = element('div', { className: 'volumes' });
        for (const [key, label] of VOLUME_LABELS) {
          const input = element('input');
          input.type = 'range';
          input.min = '0';
          input.max = '100';
          input.value = String(Math.round(settings.volumes[key] * 100));
          input.setAttribute('aria-label', label);
          input.addEventListener('change', () => {
            settings = {
              ...settings,
              volumes: { ...settings.volumes, [key]: Number(input.value) / 100 },
            };
            platform.setSettings(settings);
            options.onSettings?.(settings);
          });
          sliders.append(element('label', { text: label }, [input]));
        }
        panel.append(
          sliders,
          element('div', { className: 'boutons' }, [
            button(
              'Reprendre',
              () => {
                platform.resume();
              },
              true,
            ),
            button('Quitter la partie', () => {
              platform.quit();
            }),
          ]),
          element('p', { className: 'aide', text: 'Échap reprend aussi la partie.' }),
        );
        break;
      }
      case 'ended':
        panel.append(
          element('h2', { text: current.summary }),
          element('div', { className: 'boutons' }, [
            button(
              'Retour à l’accueil',
              () => {
                platform.quit();
                options.onExit();
              },
              true,
            ),
          ]),
        );
        break;
      case 'stopped':
        panel.append(
          element('h2', { text: 'Partie terminée' }),
          element('div', { className: 'boutons' }, [
            button('Retour à l’accueil', options.onExit, true),
          ]),
        );
        break;
      case 'error':
        panel.append(
          element('h2', { text: 'La partie s’est arrêtée' }),
          element('p', { text: current.message }),
          element('div', { className: 'boutons' }, [
            button('Retour à l’accueil', options.onExit, true),
          ]),
        );
        break;
    }
    overlay.hidden = false;
    overlay.append(panel);
  };

  const platform = options.createPlatform({
    onStatus: (status) => {
      const wasPaused = current.kind === 'paused';
      current = status;
      frame.dataset.statut = status.kind;
      render();
      if (wasPaused && status.kind === 'running') iframe.contentWindow?.focus();
    },
    onLog: (entry) => {
      logs.push(entry);
      if (logs.length > 500) logs.shift();
    },
  });

  // Pont: un MessageChannel par vue; le port est remis au jeu à sa demande ou à la fin de son chargement.
  const channel = new MessageChannel();
  platform.attachGame(channel.port1);
  let portSent = false;
  let loads = 0;
  const sendPort = (): void => {
    if (portSent || iframe.contentWindow === null) return;
    portSent = true;
    iframe.contentWindow.postMessage({ type: BRIDGE_PORT_MESSAGE, bridge: BRIDGE_VERSION }, '*', [
      channel.port2,
    ]);
  };
  window.addEventListener('message', (event: MessageEvent) => {
    const data: unknown = event.data;
    if (
      event.source === iframe.contentWindow &&
      typeof data === 'object' &&
      data !== null &&
      (data as { type?: unknown }).type === BRIDGE_PORT_REQUEST
    ) {
      sendPort();
    }
  });
  iframe.addEventListener('load', () => {
    loads++;
    // Un jeu rechargé (rechargement complet de Vite) repart de zéro: les deux vues aussi.
    if (loads > 1) {
      location.reload();
      return;
    }
    sendPort();
  });
  iframe.src = options.gameUrl;
  render();

  return { platform, iframe, logs, status: () => current };
}

/** Échap dans la page du faux hôte (focus hors du jeu): reprend la partie en pause. */
export function resumeOnEscape(views: readonly GameView[]): void {
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape') return;
    for (const view of views) {
      if (view.status().kind === 'paused') {
        view.platform.resume();
        return;
      }
    }
  });
}
