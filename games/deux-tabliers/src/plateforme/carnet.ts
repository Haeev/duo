/**
 * Carnet de séance (SDK 1.1, macOS seulement): ce que Deux Tabliers joint à chaque note du client.
 * La légende de chaque image dit le jour, l'heure du jeu, la phase, l'adresse, où est le joueur
 * local, ce qu'il regarde, ce qu'il tient et son téléphone; l'instantané garde l'essentiel du café
 * pour retrouver la situation sans la sauvegarde (aucun prénom, aucun identifiant de joueur).
 *
 * La note elle-même (zone de saisie, Entrée, Maj+Entrée, Échap) est celle du SDK. Le jeu y ajoute
 * trois choses: le pointeur rendu par le jeu juste avant (sinon le SDK le lâche seul et Duo y voit
 * un Échap, donc une pause), aucune reprise de la souris d'un clic pendant la saisie, et la souris
 * reprise sans geste quand la note se ferme.
 */
import type { NotebookSource, Role } from '@duo/sdk';
import type { World } from '../etat/monde';
import type { ClockView, DayPhase } from '../interface/modele';
import { WEEKDAYS } from '../interface/textes';
import type { GameView } from '../reseau/vue';

/** Sélecteurs de la note ouverte par le SDK (`notebook.ts`) et de sa zone de texte. */
const NOTE_SELECTOR = '[data-testid="carnet-note"]';
const TEXT_SELECTOR = '[data-testid="carnet-texte"]';

const PHASES: Readonly<Record<DayPhase, string>> = {
  'first-time': 'premier jour',
  morning: 'matin',
  preparation: 'préparation',
  service: 'service',
  'soft-closing': 'fermeture',
  closed: 'fermé',
  evening: 'soir',
  night: 'nuit',
  'day-off': 'jour de repos',
  'demo-end': 'fin de la démo',
};

export interface NotebookDeps {
  readonly view: GameView;
  readonly canvas: HTMLCanvasElement;
  readonly role: Role;
  /** Regard local de l'image en cours (le monde n'a que le dernier envoyé). */
  readonly look: () => { readonly yawDeg: number; readonly pitchDeg: number };
  /** Horloge affichée par le HUD (`InterfaceSources.clock`). */
  readonly clock: (world: World) => ClockView | null;
}

function hour(minutes: number): string {
  const whole = Math.floor(minutes);
  return `${String(Math.floor(whole / 60) % 24)} h ${String(whole % 60).padStart(2, '0')}`;
}

function num(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function euros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** Objets dans la main d'un joueur (types de `objets.json`). */
function held(world: World, player: 0 | 1): string[] {
  return world.objects
    .filter((o) => o.at.kind === 'hand' && o.at.player === player)
    .map((o) => o.type);
}

/** « Sur son téléphone : Catalogue » donne « Catalogue »; `null`: téléphone rangé. */
function phoneApp(place: string | null | undefined): string | null {
  if (place === null || place === undefined) return null;
  const at = place.lastIndexOf(':');
  return at < 0 ? place : place.slice(at + 1).trim();
}

/** Une note est en cours de saisie (zone du SDK dans la page). */
export function notebookTyping(): boolean {
  return typeof document !== 'undefined' && document.querySelector(NOTE_SELECTOR) !== null;
}

export function createNotebookSource(deps: NotebookDeps): NotebookSource {
  const { view } = deps;
  return {
    canvas: () => deps.canvas,
    caption: () => {
      const world = view.world();
      const clock = deps.clock(world);
      const time =
        clock === null
          ? 'Avant le premier jour'
          : `Jour ${String(clock.day)}, ${WEEKDAYS[clock.weekday] ?? '?'}, ${hour(clock.minutes)} (${PHASES[clock.phase]})`;
      const pose = view.pose(view.local);
      const look = deps.look();
      const me = world.players[view.local];
      const hand = held(world, view.local);
      const app = phoneApp(world.clientele.uiPlaces[view.local]);
      const parts = [
        time,
        world.address,
        `x ${num(pose.x)} z ${num(pose.z)}, regard ${String(Math.round(look.yawDeg))}° / ${String(Math.round(look.pitchDeg))}°`,
        hand.length === 0 ? 'mains vides' : `en main : ${hand.join(', ')}`,
      ];
      if (me.seat !== null) parts.push(`assis (${me.seat})`);
      if (me.use !== null) parts.push(`au poste ${me.use.furniture}`);
      parts.push(app === null ? 'téléphone rangé' : `téléphone : ${app}`);
      return parts.join(', ');
    },
    snapshot: () => {
      const world = view.world();
      const c = world.clientele;
      const s = world.service;
      const clock = deps.clock(world);
      const look = deps.look();
      return {
        role: deps.role,
        joueurLocal: view.local,
        tick: world.tick,
        adresse: world.address,
        jour: c.day,
        jourDeLaSemaine: clock === null ? null : (WEEKDAYS[clock.weekday] ?? null),
        heure: clock === null ? null : hour(clock.minutes),
        phase: c.phase,
        phaseAffichee: clock?.phase ?? null,
        rythme: c.pace,
        meteo: c.weather,
        caisse: euros(c.cash),
        aRegler: euros(c.debt),
        joueurs: world.players.map((p, i) => ({
          index: i,
          position: { x: p.x, z: p.z },
          regard: i === view.local ? look : { yawDeg: p.yawDeg, pitchDeg: p.pitchDeg },
          poste: p.use,
          assise: p.seat ?? null,
          enMain: held(world, i === 0 ? 0 : 1),
          telephone: phoneApp(c.uiPlaces[i]),
        })),
        clients: c.groups.map((g) => ({
          id: g.id,
          profil: g.profile,
          taille: g.size,
          habitue: g.regular,
          roleEvenement: g.role,
          etape: g.stage,
          depuis: g.since,
          commande: g.items,
          paye: g.paid,
          aEmporter: g.takeAway,
          place: g.place,
          assises: g.seats,
          table: g.table,
          servi: g.servedAt,
        })),
        commandesEnAttente: s.waiting,
        tickets: s.tickets,
        postesEnCours: s.processes,
        gestes: s.gestures,
        bouilloires: s.kettles,
        groupesEnPanne: s.groupsOut,
        vaisselle: { propre: s.clean, sale: s.dirtyBacklog, tablesSales: c.dirty },
        cartonsARanger: c.cartons,
        depannages: c.emergencies,
        propositions: c.proposals.map((p) => ({ par: p.by, objet: p.item, prix: p.price })),
        votes: c.votes,
        evenement: c.event,
        evenementsDuJour: c.eventsToday,
        reperes: c.conditions,
        stock: c.stock,
        remisesDuJour: c.activeDiscounts ?? null,
        objets: world.objects.length,
      };
    },
  };
}

export interface NotebookHooks {
  /** À appeler à chaque pas: reprend la souris quand la note vient de se fermer. */
  step(): void;
  dispose(): void;
}

/**
 * Branche le carnet si la plateforme l'offre. L'écouteur de Ctrl+N doit passer avant celui du SDK
 * (même cible, même phase: ordre d'inscription), d'où l'appel avant `notebook.attach`.
 */
export function attachNotebook(options: {
  readonly notebook: {
    readonly available: boolean;
    readonly enabled: boolean;
    attach(source: NotebookSource): () => void;
    trace(event: string, data?: unknown): void;
  };
  readonly source: NotebookSource;
  readonly onEvent: (listener: (event: { readonly type: string }) => void) => () => void;
  /** Le joueur a la souris dans le café (pointeur verrouillé). */
  readonly locked: () => boolean;
  readonly release: () => void;
  /** Reprend la souris si le jeu le permet (partie en cours, aucun panneau). */
  readonly regrab: () => void;
}): NotebookHooks {
  if (!options.notebook.available) return { step: () => undefined, dispose: () => undefined };
  const { notebook } = options;
  let wasTyping = false;
  let hadPointer = false;
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyN' || !event.ctrlKey || event.shiftKey || event.metaKey) return;
    if (event.altKey || event.repeat || !notebook.enabled || notebookTyping()) return;
    hadPointer = options.locked();
    // Rendu par le jeu: Duo ne prend pas ce déverrouillage pour un Échap (pause).
    if (hadPointer) options.release();
  };
  // Les écrans du jeu se redessinent et redonnent le focus à leur bouton par défaut: pendant la
  // note, le focus revient à la zone de texte, sinon la frappe partirait au jeu.
  const onFocusIn = (event: FocusEvent): void => {
    const note = document.querySelector(NOTE_SELECTOR);
    if (note === null || (event.target instanceof Node && note.contains(event.target))) return;
    const area = note.querySelector(TEXT_SELECTOR);
    if (area instanceof HTMLTextAreaElement) area.focus({ preventScroll: true });
  };
  window.addEventListener('keydown', onKeyDown, { capture: true });
  document.addEventListener('focusin', onFocusIn, { capture: true });
  const detach = notebook.attach(options.source);
  const offEvents = options.onEvent((event) => {
    notebook.trace(event.type, event);
  });
  return {
    step() {
      const typing = notebookTyping();
      if (wasTyping && !typing) {
        if (hadPointer) options.regrab();
        hadPointer = false;
      }
      wasTyping = typing;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('focusin', onFocusIn, { capture: true });
      offEvents();
      detach();
    },
  };
}
