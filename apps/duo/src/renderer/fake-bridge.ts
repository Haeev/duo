// Faux pont: imite preload-platform dans Chromium seul (ADR 0012, point 9), avec
// des scénarios nommés pour les tests d'interface et les captures. Il ne contient
// aucune règle de la plateforme: juste assez pour parcourir les écrans.
import type { DuoApi, IntentResult } from '../shared/ipc';
import type { AppState, GameSummary, MatchView, SalonView } from '../shared/state';

const THUMBNAIL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#2a3a5c"/><circle cx="11" cy="3" r="1.4" fill="#ffc857"/><path d="M0 9 L5 4 L9 7 L12 5 L16 9Z" fill="#3e6b4f"/></svg>',
  );

const GAME: GameSummary = {
  id: 'jeu-temoin',
  name: 'Jeu témoin',
  version: '1.0.0',
  mode: 'coop',
  play: 'session',
  durationMinutes: [20, 40],
  description: 'Un petit jeu à deux pour éprouver toute la chaîne.',
  thumbnailUrl: THUMBNAIL,
  actions: [
    { id: 'move-up', label: 'Avancer', keys: ['KeyW'], mouse: [] },
    { id: 'move-left', label: 'Aller à gauche', keys: ['KeyA'], mouse: [] },
    { id: 'act', label: 'Agir', keys: ['Space'], mouse: ['left'] },
  ],
  saves: { help: 'Le jeu enregistre à l’aube et en quittant.', onExit: true },
  lastSave: { label: 'Jour 3', writtenAt: Date.now() - 86_400_000 },
};

const BASE: AppState = {
  appVersion: '0.1.0',
  platform: 'darwin',
  profile: { pseudo: 'Camille', color: 'orb' },
  setup: { networkAccepted: true, done: true },
  settings: { reducedMotion: null, uiScale: 1 },
  peer: { status: 'present', profile: { pseudo: 'Sacha', color: 'crescent' } },
  games: [GAME],
  salon: null,
  invitation: null,
  match: null,
  end: null,
  notice: null,
  toasts: [],
  quitConfirm: false,
};

const SALON: SalonView = {
  role: 'host',
  game: GAME,
  saveChoice: 'continue',
  save: GAME.lastSave,
  selfReady: false,
  peerReady: true,
  peerSeat: 'joined',
  countdownEndsAt: null,
};

const MATCH: MatchView = {
  role: 'host',
  game: GAME,
  phase: 'playing',
  selfLoading: 1,
  peerLoading: 1,
  loadingSince: Date.now(),
  pausedBy: { self: false, peer: false },
  resumeReady: { self: false, peer: false },
  resumeEndsAt: null,
  linkLostSince: null,
  peerBack: false,
  hintUntil: null,
};

function scenarioState(name: string | null): AppState {
  switch (name) {
    case 'premier-lancement':
      return {
        ...BASE,
        profile: null,
        setup: { networkAccepted: false, done: false },
        peer: { status: 'unknown' },
      };
    case 'accueil-absent':
      return {
        ...BASE,
        peer: { status: 'absent', profile: { pseudo: 'Sacha', color: 'crescent' } },
      };
    case 'invitation':
      return {
        ...BASE,
        invitation: { from: { pseudo: 'Sacha', color: 'crescent' }, game: GAME, save: null },
      };
    case 'salon-hote':
      return { ...BASE, salon: SALON };
    case 'salon-attente':
      return { ...BASE, salon: { ...SALON, peerSeat: 'waiting', peerReady: false } };
    case 'salon-invite':
      return { ...BASE, salon: { ...SALON, role: 'guest', selfReady: true, peerReady: false } };
    case 'decompte':
      return { ...BASE, salon: { ...SALON, selfReady: true, countdownEndsAt: Date.now() + 2500 } };
    case 'chargement':
      return {
        ...BASE,
        match: { ...MATCH, phase: 'loading', selfLoading: 0.8, peerLoading: null },
      };
    case 'pause':
      return {
        ...BASE,
        match: { ...MATCH, phase: 'paused', pausedBy: { self: false, peer: true } },
      };
    case 'coupure':
      return {
        ...BASE,
        match: { ...MATCH, phase: 'link-lost', linkLostSince: Date.now() - 42_000 },
      };
    case 'fin':
      return {
        ...BASE,
        salon: SALON,
        end: {
          game: GAME,
          kind: 'session',
          durationMs: 4_320_000,
          saved: true,
          outcome: null,
          winner: null,
          stats: [
            { label: 'Journées vécues', value: '8' },
            { label: 'Commande remplie', value: '4 sur 4' },
            { label: 'Meubles posés', value: '9' },
          ],
        },
      };
    case 'arret':
      return {
        ...BASE,
        salon: SALON,
        notice: { kind: 'game-crashed', gameName: GAME.name, where: 'peer', hadSave: true },
      };
    case 'quitter':
      return {
        ...BASE,
        match: { ...MATCH, phase: 'paused', pausedBy: { self: true, peer: false } },
        quitConfirm: true,
      };
    case null:
    default:
      return BASE;
  }
}

export function createFakeBridge(scenario: string | null): DuoApi {
  let state = scenarioState(scenario);
  const listeners = new Set<(state: AppState) => void>();
  const update = (next: AppState): void => {
    state = next;
    for (const listener of listeners) listener(state);
  };
  const ok: IntentResult = { ok: true };
  return {
    invoke(channel, arg) {
      switch (channel) {
        case 'profile:save':
          update({ ...state, profile: arg as AppState['profile'] });
          break;
        case 'setup:network-accept':
          update({ ...state, setup: { ...state.setup, networkAccepted: true } });
          break;
        case 'setup:complete':
          update({ ...state, setup: { ...state.setup, done: true } });
          break;
        case 'salon:open':
          update({ ...state, salon: { ...SALON, peerSeat: 'waiting', peerReady: false } });
          break;
        case 'salon:close':
        case 'salon:leave':
          update({ ...state, salon: null });
          break;
        case 'salon:join':
          update({
            ...state,
            invitation: null,
            salon: { ...SALON, role: 'guest', selfReady: true, peerReady: false },
          });
          break;
        case 'salon:ready':
          if (state.salon !== null)
            update({
              ...state,
              salon: { ...state.salon, selfReady: (arg as { ready: boolean }).ready },
            });
          break;
        case 'end:dismiss':
          update({ ...state, end: null });
          break;
        case 'notice:dismiss':
          update({ ...state, notice: null });
          break;
        case 'app:quit-cancel':
          update({ ...state, quitConfirm: false });
          break;
        case 'settings:update':
        case 'salon:save-choice':
        case 'match:pause':
        case 'match:resume':
        case 'match:stop':
        case 'app:quit-confirm':
        case 'window:toggle-fullscreen':
        case 'library:install-file':
          break;
      }
      return Promise.resolve(ok);
    },
    getState() {
      return Promise.resolve(state);
    },
    onState(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
