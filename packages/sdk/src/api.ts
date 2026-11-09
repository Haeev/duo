// API publique du SDK des jeux Duo (ADR 0005, point 4). Le jeu ne voit que ces types:
// le pont MessagePort, sa version et ses messages restent internes au SDK.
import type {
  GameManifest,
  GameSettings,
  MatchOutcome,
  PauseReason,
  PlayerColorId,
  ResultStat,
  Role,
  SaveMoment,
  SaveStatus,
  StopReason,
  Volumes,
} from '@duo/protocol';
import type { GenericSchema, InferOutput } from 'valibot';
import type { RandomSource } from './random';

export type {
  GameManifest,
  GameSettings,
  MatchOutcome,
  PauseReason,
  PlayerColorId,
  ResultStat,
  Role,
  SaveMoment,
  SaveStatus,
  StopReason,
  Volumes,
};
export type { RandomSource, RandomState } from './random';

/** Fonction qui retire l'écouteur qu'on vient d'ajouter. */
export type Unsubscribe = () => void;

// Joueurs et partie.

/** Un des deux joueurs. `id` est stable d'une partie à l'autre: c'est l'identifiant de membre du duo. */
export interface Player {
  readonly id: string;
  readonly role: Role;
  /** Pseudo du profil Duo (1 à 16 graphèmes). */
  readonly name: string;
  /** Profil de couleur, lié pour toujours à un symbole (`orb`, `crescent`, `star`, `sun`, `planet`, `comet`). */
  readonly color: PlayerColorId;
  /** Couleur du profil, `#RRGGBB`. */
  readonly colorHex: string;
  /** `true` pour le joueur de cette machine. */
  readonly local: boolean;
}

/** États du cycle de vie vus par le jeu (ADR 0005, point 3). */
export type LifecycleState = 'loading' | 'ready' | 'running' | 'paused' | 'stopped';

/** Événements du cycle de vie et de la plateforme. */
export interface DuoEvents {
  /** Départ synchronisé: les deux machines commencent ensemble. */
  readonly start: { readonly atSessionMs: number };
  /** Pause de la plateforme (Échap d'un joueur, coupure). La boucle s'arrête d'elle-même. */
  readonly pause: { readonly reason: PauseReason; readonly by: Player | null };
  /** Reprise décidée par la plateforme. */
  readonly resume: Record<string, never>;
  /** Réglages changés pendant la pause (volumes, taille de l'interface, touches). */
  readonly settings: GameSettings;
  /**
   * Fin de la partie demandée par la plateforme. Chez l'hôte, la sauvegarde de sortie
   * (fournie par `saves.provide`) est déjà écrite quand cet événement arrive.
   */
  readonly stop: { readonly reason: StopReason };
  /** Qualité de la liaison mise à jour (environ deux fois par seconde). */
  readonly link: LinkQuality;
}

// Boucle à pas fixe.

/** Un pas de simulation. */
export interface StepInfo {
  /** Numéro du pas, à partir de 0 au démarrage de la boucle. */
  readonly tick: number;
  /** Durée d'un pas, en secondes (1/60 par défaut). */
  readonly dt: number;
}

/** Une image affichée. */
export interface FrameInfo {
  /** Avancement entre le dernier pas et le suivant, de 0 à 1, pour interpoler l'affichage. */
  readonly alpha: number;
  /** Temps écoulé depuis l'image précédente, en secondes. */
  readonly dt: number;
}

export interface LoopOptions {
  /** Pas par seconde, 60 par défaut. */
  readonly hz?: number;
  /** Simulation: appelée à pas fixe, cadencée par des minuteurs (elle tourne fenêtre réduite). */
  readonly step: (step: StepInfo) => void;
  /** Rendu: appelé à chaque image (`requestAnimationFrame`), y compris pendant la pause. */
  readonly render?: (frame: FrameInfo) => void;
}

export interface Loop {
  /** Démarre la boucle. Les pas s'arrêtent pendant les pauses de la plateforme, le rendu continue. */
  start(options: LoopOptions): void;
  stop(): void;
  readonly running: boolean;
  /** Numéro du prochain pas. */
  readonly tick: number;
}

// Entrées.

/** Bouton ou molette de la souris, tels que le manifeste les nomme. */
export type MouseInput = 'left' | 'middle' | 'right' | 'wheel-up' | 'wheel-down';

export interface PointerState {
  /** Position en pixels CSS, relative à l'élément suivi (`input.attach`). */
  readonly x: number;
  readonly y: number;
  /** Position normalisée de -1 à 1 (y vers le haut), prête pour un lancer de rayon Three.js. */
  readonly ndcX: number;
  readonly ndcY: number;
  /** `true` si le pointeur est au-dessus de l'élément suivi. */
  readonly inside: boolean;
  readonly left: boolean;
  readonly middle: boolean;
  readonly right: boolean;
  /** Crans de molette depuis le pas précédent (positif vers le bas). */
  readonly wheel: number;
  /** `true` si le pointeur est verrouillé (`lockPointer`). */
  readonly locked: boolean;
  /** Déplacement depuis le pas précédent, en pixels CSS (utile verrouillé). */
  readonly movementX: number;
  readonly movementY: number;
}

/** État des entrées d'un pas, sérialisable: ce que l'invité envoie à l'hôte. */
export interface InputFrame<TAction extends string = string> {
  readonly down: readonly TAction[];
  readonly pressed: readonly TAction[];
  readonly released: readonly TAction[];
  readonly pointer: {
    readonly ndcX: number;
    readonly ndcY: number;
    readonly inside: boolean;
    readonly wheel: number;
  };
}

export interface Input<TAction extends string = string> {
  /** Action tenue en ce moment. */
  isDown(action: TAction): boolean;
  /** Action enfoncée depuis le pas précédent (vrai pendant un seul pas). */
  wasPressed(action: TAction): boolean;
  /** Action relâchée depuis le pas précédent. */
  wasReleased(action: TAction): boolean;
  readonly pointer: PointerState;
  /** Instantané des entrées du pas, à envoyer par le réseau. */
  frame(): InputFrame<TAction>;
  /** Élément dont on suit le pointeur (le canvas du jeu); `document.body` par défaut. */
  attach(element: HTMLElement): void;
  lockPointer(): void;
  /**
   * Rend le pointeur. Passer par ici (et non par `document.exitPointerLock`): un déverrouillage
   * que le jeu n'a pas demandé, fenêtre active et partie en cours, est pris pour Échap et
   * demande la pause de Duo.
   */
  unlockPointer(): void;
  /**
   * Libellé d'une touche selon la disposition réelle du clavier (`KeyW` donne « Z » en AZERTY).
   * Disposition inconnue: AZERTY.
   */
  keyLabel(code: string): string;
  /** Libellé de la première touche (ou du bouton) d'une action, pour l'interface du jeu. */
  actionLabel(action: TAction): string;
  /** Touches effectives d'une action (manifeste, ou réaffectation des réglages). */
  keysOf(action: TAction): readonly string[];
}

// Réseau (ADR 0007, reseau.md section 12.6).

/** `reliable`: dans l'ordre, une fois, même après une reprise. `latest`: seul le dernier compte (instantanés). */
export type ChannelMode = 'reliable' | 'latest';

export interface ChannelOptions<TSchema extends GenericSchema> {
  readonly mode: ChannelMode;
  /** Schéma Valibot de chaque message: un message reçu invalide est jeté et journalisé. */
  readonly schema: TSchema;
}

export interface NetChannel<T> {
  readonly id: number;
  /** Envoie à l'instance du jeu sur l'autre machine. JSON seulement, 64 Kio au plus une fois sérialisé. */
  send(message: T): void;
  /**
   * Messages reçus de l'autre machine. Ceux arrivés avant le premier écouteur sont gardés
   * et lui sont remis (le dernier seulement en mode `latest`).
   */
  onMessage(listener: (message: T) => void): Unsubscribe;
}

export interface LinkQuality {
  readonly rttMs: number;
  readonly jitterMs: number;
  readonly state: 'good' | 'unstable';
}

export interface Net {
  readonly role: Role;
  /** Heure de session commune aux deux machines, en millisecondes. */
  sessionTimeMs(): number;
  quality(): LinkQuality;
  /**
   * Ouvre le canal `id` (0 à 15) avec son mode et son schéma; les deux machines ouvrent les
   * mêmes canaux. Un identifiant hors limites ou déjà pris lève une erreur.
   */
  channel<TSchema extends GenericSchema>(
    id: number,
    options: ChannelOptions<TSchema>,
  ): NetChannel<InferOutput<TSchema>>;
}

// Sauvegardes (hôte seulement).

/** Ce que le jeu enregistre. `data` est sérialisé en JSON par le SDK. */
export interface SaveSnapshot {
  /** Libellé affiché dans la fiche du jeu (« Jour 3 »), 40 caractères au plus. */
  readonly label: string;
  /** Progression de 0 à 1, facultative. */
  readonly progress?: number;
  /** Version du format des données, entier à partir de 1 (migrations du jeu). */
  readonly dataSchema: number;
  readonly data: unknown;
}

/** Sauvegarde choisie au salon. `data` est le JSON relu: le jeu le valide et le migre. */
export interface LoadedSave {
  readonly slot: number;
  readonly label: string;
  readonly progress?: number;
  readonly dataSchema: number;
  readonly gameVersion: string;
  readonly data: unknown;
}

export interface HostSaves {
  /** Emplacement ouvert à l'écriture, `null` si le jeu n'a pas de sauvegarde. */
  readonly slot: number | null;
  /** Sauvegarde reprise, `null` pour une nouvelle partie. */
  readonly loaded: LoadedSave | null;
  /**
   * Fournit l'état à enregistrer quand la plateforme le demande: sauvegarde automatique,
   * pause, sortie. `null`: rien à enregistrer pour l'instant.
   */
  provide(provider: () => SaveSnapshot | null): void;
  /** Écrit tout de suite, à un moment déclaré dans le manifeste (`level-end`, `manual`, ...). */
  write(moment: SaveMoment, snapshot: SaveSnapshot): Promise<SaveStatus>;
}

// Résultats (hôte seulement).

export interface MatchResult {
  readonly outcome: MatchOutcome;
  /** Score par identifiant de joueur. */
  readonly scores: Readonly<Record<string, number>>;
  /** Trois statistiques au plus pour l'écran de fin. */
  readonly stats?: readonly ResultStat[];
  readonly progress?: number;
  /** Libellé du bouton « Rejouer » (« Niveau suivant »). */
  readonly replayLabel?: string;
}

export interface SessionSummary {
  readonly progress?: number;
  readonly stats?: readonly ResultStat[];
}

export interface HostResults {
  /** Jeux `match`: fin de partie, avec son issue. */
  endMatch(result: MatchResult): void;
  /**
   * Jeux `session`: le jeu termine la séance de lui-même (fin de la démo). Quand c'est la
   * plateforme qui arrête la séance, le SDK répond seul avec la progression de la dernière sauvegarde.
   */
  endSession(summary?: SessionSummary): void;
}

// Audio.

/** Bus de mixage: gain effectif = volume général x volume du bus (réglages de la machine). */
export type AudioBus = 'music' | 'effects' | 'interface';

export interface PlayOptions {
  readonly bus?: AudioBus;
  /** Volume propre au son, de 0 à 1 (1 par défaut). */
  readonly volume?: number;
  readonly loop?: boolean;
  /** Vitesse de lecture (1 par défaut). */
  readonly rate?: number;
}

export interface PlayingSound {
  stop(fadeOutMs?: number): void;
  readonly ended: Promise<void>;
}

export interface Audio {
  /** Contexte audio unique du jeu, créé au premier usage, réveillé au premier geste du joueur. */
  readonly context: AudioContext;
  /** Nœud d'entrée d'un bus, pour y brancher ses propres sources. */
  bus(name: AudioBus): GainNode;
  /** Charge et décode un effet (adresse relative au paquet du jeu). */
  load(path: string): Promise<AudioBuffer>;
  /** Joue un son décodé, sur le bus des effets par défaut. */
  play(buffer: AudioBuffer, options?: PlayOptions): PlayingSound;
  /** Joue une musique en flux, sur le bus musique, en boucle par défaut. */
  playMusic(path: string, options?: PlayOptions & { readonly fadeInMs?: number }): PlayingSound;
}

// Divers.

export interface Assets {
  /** Adresse d'un fichier du paquet du jeu (chemin relatif à `index.html`). */
  url(path: string): string;
}

export interface Logger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export interface UiSettings {
  /** Taille de l'interface: 1, 1,25 ou 1,5. */
  readonly scale: 1 | 1.25 | 1.5;
  readonly reducedMotion: boolean;
}

// Carnet de séance (pont 1.1).

/** Ce que le jeu prête au carnet de séance. */
export interface NotebookSource {
  /** Canevas du jeu (WebGL ou 2D), lu juste après chaque rendu de la boucle. */
  canvas(): HTMLCanvasElement | null;
  /** Légende courte de chaque image et de la note: jour et heure du jeu, position du joueur. */
  caption?(): string;
  /** État utile au studio au moment de la note, sérialisable en JSON. */
  snapshot?(): unknown;
}

/**
 * Carnet de séance: Ctrl+N ouvre une note par-dessus le jeu (Entrée enregistre, Échap annule,
 * le jeu continue); la note part avec les images des 10 s d'avant et des 10 s d'après, dans un
 * dossier de la machine. Ctrl+Maj+N l'active ou le coupe. Inerte quand la plateforme ne l'offre
 * pas (hors macOS, Duo trop ancien, faux hôte).
 */
export interface Notebook {
  /** La plateforme offre le carnet sur cette machine. */
  readonly available: boolean;
  /** Activé par le joueur (réglage gardé par la plateforme). */
  readonly enabled: boolean;
  /** Branche le jeu: capture des images et raccourcis. */
  attach(source: NotebookSource): Unsubscribe;
  /** Événement récent joint aux notes (les 100 derniers sont gardés). */
  trace(event: string, data?: unknown): void;
}

// Contexte remis au jeu.

interface DuoContextBase<TAction extends string> {
  readonly role: Role;
  /** Identifiant de cette partie ou séance. */
  readonly matchId: string;
  readonly manifest: GameManifest;
  /** Graine partagée par les deux machines. */
  readonly seed: number;
  /** Hôte d'abord, puis invité. */
  readonly players: readonly [Player, Player];
  readonly host: Player;
  readonly guest: Player;
  readonly localPlayer: Player;
  readonly remotePlayer: Player;
  readonly state: LifecycleState;
  readonly settings: GameSettings;
  readonly ui: UiSettings;

  on<K extends keyof DuoEvents>(event: K, listener: (payload: DuoEvents[K]) => void): Unsubscribe;
  /** Progression du chargement, de 0 à 1, affichée par la plateforme. */
  reportLoading(progress: number): void;
  /** Le jeu est chargé: attend le départ synchronisé des deux machines. */
  ready(): Promise<void>;
  /**
   * Générateur à graine. Sans libellé: la graine de la partie. Avec un libellé: un flux
   * indépendant et reproductible (`random('meteo')`). `Math.random` est interdit dans la simulation.
   */
  random(label?: string): RandomSource;

  readonly loop: Loop;
  readonly input: Input<TAction>;
  readonly net: Net;
  readonly audio: Audio;
  readonly assets: Assets;
  readonly log: Logger;
  readonly notebook: Notebook;
  /** Libère tout (boucle, écouteurs, minuteurs, audio, pont). Duo détruit la vue de toute façon. */
  dispose(): void;
}

export interface HostContext<TAction extends string = string> extends DuoContextBase<TAction> {
  readonly role: 'host';
  readonly saves: HostSaves;
  readonly results: HostResults;
}

export interface GuestContext<TAction extends string = string> extends DuoContextBase<TAction> {
  readonly role: 'guest';
}

/** Contexte du jeu, typé par rôle: chez l'invité, `saves` et `results` n'existent pas. */
export type DuoContext<TAction extends string = string> =
  HostContext<TAction> | GuestContext<TAction>;

export interface ConnectOptions {
  /** Contenu de `duo-game.json` (import JSON), validé par le SDK. */
  readonly manifest: unknown;
  /** Attente maximale du pont et du message `init`, 15 000 ms par défaut. */
  readonly timeoutMs?: number;
  /** Port du pont fourni directement (tests). Sinon, le SDK attend celui que remet la page. */
  readonly port?: MessagePort;
}
