/**
 * Adaptateur entre la `GameView` et le contrat de lecture de l'interface (`modele.ts`).
 *
 * Ce que le cœur fournit déjà est lu ici: objet en main (plateau compris), lieu de l'autre
 * (zones du plan), poste qu'il utilise. Le reste vient des chantiers par `InterfaceSources`:
 * chaque lecteur est facultatif, et l'interface montre l'état vide tant qu'il manque.
 *
 * À l'intégration (manager): chaque chantier écrit ses lecteurs dans son dossier, sans DOM,
 * et `main.ts` les passe à `createInterface({ sources })`. Les actions de l'interface
 * (`UiAction`) deviennent des intentions par `toIntent`, à compléter quand les chantiers ont
 * publié leurs `*_INTENTS` (table `INTENT_FOR` ci-dessous).
 */
import { v } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { GameView } from '../reseau/vue';
import type { Intent, Target } from '../simulation/entrees';
import type { GameEvent } from '../simulation/evenements';
import type { UiAction } from './actions';
import type {
  AlertView,
  CatalogueView,
  ClockView,
  DemoEndView,
  DialogueView,
  DiscountsView,
  DuoSettingsView,
  MarketingView,
  EveningView,
  EventSceneView,
  GaugeView,
  HeldView,
  HouseSetupView,
  HouseView,
  InterfaceModel,
  MorningView,
  NightView,
  OrdersView,
  PartnerActivity,
  ProjectsView,
  ProposalView,
  SlateView,
  TicketView,
  TimerView,
} from './modele';
import { T } from './textes';

/** Lecteurs fournis par les chantiers (purs: monde et contenu en entrée, vue en sortie). */
export interface InterfaceSources {
  /** b: horloge, jour, météo, moment, arrêt. */
  clock?(world: World, content: Content): ClockView | null;
  /** b: maison, caisse, somme réservée, réputation. */
  house?(world: World, content: Content): HouseView | null;
  /** a: tickets pris par ce joueur, le plus ancien d'abord. */
  tickets?(world: World, player: PlayerIndex): readonly TicketView[];
  /** a: ticket du rail sous le point de visée (carte de lecture). */
  aimedTicket?(world: World, player: PlayerIndex, target: Target | null): TicketView | null;
  /** a: ce que tient un joueur, si le cœur ne suffit pas (ticket servi, contenu d'une tasse). */
  held?(world: World, player: PlayerIndex): HeldView | null;
  /** a, b, c: ce que fait un joueur (« Attend pour porter », « Fait une pause depuis 1 min »). */
  activity?(world: World, player: PlayerIndex): string | null;
  /** a: geste en cours de ce joueur (jauge, fenêtre, maintien), jugé chez lui. */
  gauge?(world: World, player: PlayerIndex): GaugeView | null;
  /** a: minuteries lancées par ce joueur, hors de sa vue. */
  timers?(world: World, player: PlayerIndex): readonly TimerView[];
  /** b: astuce du moment pour ce joueur (premiers jours). */
  hint?(world: World, player: PlayerIndex): string | null;
  /** b, c: propositions en cours (ouvrir, fermer plus tôt, gros achat). */
  proposals?(world: World): readonly ProposalView[];
  /** b: réplique d'un habitué adressée à ce joueur (indice privé compris). */
  dialogue?(world: World, player: PlayerIndex): DialogueView | null;
  /** b: scène d'événement en cours, vue par ce joueur. */
  scene?(world: World, player: PlayerIndex): EventSceneView | null;
  morning?(world: World, content: Content): MorningView | null;
  /** a, b: ardoise (recettes, lignes, verrous). */
  slate?(world: World, content: Content): SlateView | null;
  /** b: commandes aux fournisseurs. */
  orders?(world: World, content: Content): OrdersView | null;
  /** b: onglet « Remises » (v0.2). */
  discounts?(world: World, content: Content): DiscountsView | null;
  /** b: onglet « Faire connaître » (v0.2), états par joueur. */
  marketing?(world: World, content: Content, player: PlayerIndex): MarketingView | null;
  /** c: catalogue et achats (états par joueur). */
  catalogue?(world: World, content: Content, player: PlayerIndex): CatalogueView | null;
  /** b: nos projets. */
  projects?(world: World, content: Content): ProjectsView | null;
  /** b: bilan du soir vu par ce joueur (page de l'autre). */
  evening?(world: World, player: PlayerIndex): EveningView | null;
  night?(world: World): NightView | null;
  demoEnd?(world: World): DemoEndView | null;
  /** b: écran « Notre maison » tant que la maison n'a pas de nom. */
  houseSetup?(world: World): HouseSetupView | null;
  duoSettings?(world: World): DuoSettingsView | null;
  /** Où est un joueur dans l'interface (« Sur la tablette : catalogue »), partagé par le réseau. */
  uiPlace?(world: World, player: PlayerIndex): string | null;
  /** a, b, c: alerte douce tirée d'un événement, pour ce joueur (`null`: rien à montrer). */
  alert?(event: GameEvent, local: PlayerIndex): AlertView | null;
  /** a: mot de qualité d'un geste de ce joueur (« Parfait », « Bien », « Correct »). */
  quality?(event: GameEvent, local: PlayerIndex): string | null;
}

/**
 * Intentions des actions de l'interface, par type. Vide tant que les chantiers n'ont pas publié
 * les leurs: l'action est alors gardée localement (journal) et rien ne change dans le monde.
 */
export type IntentFor = {
  readonly [K in UiAction['type']]?: (action: Extract<UiAction, { type: K }>) => Intent | null;
};

export function toIntent(action: UiAction, table: IntentFor): Intent | null {
  const build = table[action.type] as ((a: UiAction) => Intent | null) | undefined;
  return build === undefined ? null : build(action);
}

const ZoneSchema = v.looseObject({
  kind: v.string(),
  label: v.string(),
  shape: v.object({ rect: v.tuple([v.number(), v.number(), v.number(), v.number()]) }),
});
type Zone = v.InferOutput<typeof ZoneSchema>;

/** Zones du plan (format du level designer, lues sans exiger plus que nécessaire). */
export function planZones(content: Content): readonly Zone[] {
  const level = content.plan.levels[0] as unknown as { zones?: unknown };
  const parsed = v.safeParse(v.array(ZoneSchema), level.zones ?? []);
  return parsed.success ? parsed.output.filter((z) => z.kind !== 'backdrop') : [];
}

/** Lieu d'un point, dit comme on le dit à voix haute (« Derrière le comptoir »). */
export function placeOf(zones: readonly Zone[], x: number, z: number): string | null {
  let best: Zone | null = null;
  let bestArea = Infinity;
  for (const zone of zones) {
    const [zx, zz, w, d] = zone.shape.rect;
    if (x < zx || x > zx + w || z < zz || z > zz + d) continue;
    const area = w * d;
    if (area < bestArea) {
      bestArea = area;
      best = zone;
    }
  }
  if (best === null) return null;
  const label = best.label.toLowerCase();
  if (best.kind === 'work') return T.places.work;
  if (best.kind === 'private') return T.places.private;
  if (label.includes('terrasse')) return T.places.terrace;
  if (label.includes('fond')) return T.places.back;
  if (label.includes('file')) return T.places.queue;
  if (label.includes('porte')) return T.places.door;
  if (label.includes('place')) return T.places.square;
  return T.places.free;
}

/** Ce que tient un joueur, d'après les objets du cœur (plateau et son contenu compris). */
export function heldFromWorld(
  content: Content,
  world: World,
  player: PlayerIndex,
): HeldView | null {
  const object = world.objects.find((o) => o.at.kind === 'hand' && o.at.player === player);
  if (object === undefined) return null;
  const type = content.objects.get(object.type);
  const label = type?.label ?? object.type;
  const places = type?.tray?.places ?? 0;
  if (places === 0) return { label, detail: null };
  const onTray = world.objects.filter((o) => o.at.kind === 'tray' && o.at.tray === object.id);
  const names = onTray.map((o) => (content.objects.get(o.type)?.label ?? o.type).toLowerCase());
  return {
    label: names.length === 0 ? label : `${label} : ${names.join(', ')}`,
    detail: `${String(onTray.length)} sur ${String(places)} places`,
  };
}

export interface ReadOptions {
  readonly sources: InterfaceSources;
  readonly zones: readonly Zone[];
  /** Cible sous le point de visée de ce joueur. */
  readonly target: Target | null;
}

/** Modèle complet de l'interface pour cette machine. */
export function readInterfaceModel(view: GameView, options: ReadOptions): InterfaceModel {
  const world = view.world();
  const content = view.content;
  const s = options.sources;
  const local = view.local;
  const other: PlayerIndex = local === 0 ? 1 : 0;
  const held = (p: PlayerIndex): HeldView | null =>
    s.held?.(world, p) ?? heldFromWorld(content, world, p);

  const pose = view.pose(other);
  const uiPlace = s.uiPlace?.(world, other) ?? null;
  const use = world.players[other].use;
  const station =
    use === null
      ? null
      : (content.furniture.get(world.furniture.find((f) => f.id === use.furniture)?.type ?? '')
          ?.label ?? null);
  const partner: PartnerActivity = {
    place: uiPlace ?? placeOf(options.zones, pose.x, pose.z),
    doing:
      s.activity?.(world, other) ??
      (station === null ? null : `Utilise : ${station.toLowerCase()}`),
  };

  return {
    local,
    clock: s.clock?.(world, content) ?? null,
    house: s.house?.(world, content) ?? null,
    myTickets: s.tickets?.(world, local) ?? [],
    aimedTicket: s.aimedTicket?.(world, local, options.target) ?? null,
    held: [held(0), held(1)],
    partner,
    gauge: s.gauge?.(world, local) ?? null,
    timers: s.timers?.(world, local) ?? [],
    hint: s.hint?.(world, local) ?? null,
    proposals: s.proposals?.(world) ?? [],
    dialogue: s.dialogue?.(world, local) ?? null,
    scene: s.scene?.(world, local) ?? null,
    morning: s.morning?.(world, content) ?? null,
    slate: s.slate?.(world, content) ?? null,
    orders: s.orders?.(world, content) ?? null,
    discounts: s.discounts?.(world, content) ?? null,
    marketing: s.marketing?.(world, content, local) ?? null,
    catalogue: s.catalogue?.(world, content, local) ?? null,
    projects: s.projects?.(world, content) ?? null,
    evening: s.evening?.(world, local) ?? null,
    night: s.night?.(world) ?? null,
    demoEnd: s.demoEnd?.(world) ?? null,
    houseSetup: s.houseSetup?.(world) ?? null,
    duoSettings: s.duoSettings?.(world) ?? null,
  };
}
