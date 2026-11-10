/**
 * Modèle de vue de l'atelier, pur et testé: ce que montrent la grille et le détail pour ce joueur
 * à ce poste, d'après l'état reçu et les règles de `simulation/fabrication/`. Un seul écran pour
 * les quatre usages (fabriquer, améliorer, réparer, affûter): les onglets sont ceux du poste.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { CraftService, CraftStation } from '../../donnees/schemas/plan';
import type { ReadonlyWorld } from '../../etat/monde';
import {
  isPlanKnown,
  materialCount,
  orderOf,
  planOutput,
  plansAt,
  repairPrice,
  stationOf,
  timesMade,
  upgradeAt,
} from '../../simulation/fabrication/plans';
import { CRAFTING } from '../../simulation/fabrication/reglages';
import { toolWearRatio } from '../../simulation/sac/outils';

export interface MaterialLine {
  readonly item: string;
  readonly name: string;
  readonly need: number;
  readonly pockets: number;
  readonly chests: number;
}

export type TileState =
  'ok' | 'missing' | 'too-expensive' | 'unknown' | 'sharp' | 'pending' | 'cannot';

export interface WorkshopTile {
  /** Plan (fabriquer) ou case de la barre (`case-<n>`, outils). */
  readonly id: string;
  readonly plan: string | null;
  readonly slot: number | null;
  /** Objet montré en vignette (la variante choisie pour un meuble). */
  readonly item: string;
  readonly name: string;
  readonly state: TileState;
  /** Couleurs des variantes d'un meuble (vide sinon). */
  readonly colors: readonly { readonly color: string; readonly name: string }[];
  readonly series: string | null;
  readonly materials: readonly MaterialLine[];
  readonly cents: number | null;
  /** Usure restante de l'outil, 0 à 1. */
  readonly wear: number | null;
  /** Outil obtenu par l'amélioration. */
  readonly to: string | null;
  readonly later: boolean;
  readonly made: number;
  readonly work: number;
}

export interface WorkshopUiState {
  readonly target: string;
  readonly tab: CraftService;
  readonly focus: number;
  readonly variant: number;
}

export interface WorkshopModel {
  readonly station: CraftStation;
  readonly name: string;
  readonly tabs: readonly CraftService[];
  readonly tab: CraftService;
  readonly tiles: readonly WorkshopTile[];
  readonly focus: number;
  readonly variant: number;
  readonly detail: WorkshopTile | null;
  /** Commande en cours chez l'artisan (outil, jour prêt). */
  readonly order: { readonly item: string; readonly day: number } | null;
}

function nameOf(content: Content, item: string): string {
  return content.items[item]?.name ?? item;
}

function base(id: string, item: string, name: string, state: TileState): WorkshopTile {
  return {
    id,
    item,
    name,
    state,
    plan: null,
    slot: null,
    colors: [],
    series: null,
    materials: [],
    cents: null,
    wear: null,
    to: null,
    later: false,
    made: 0,
    work: 0,
  };
}

/** Le modèle de l'atelier ouvert pour ce joueur, ou `null` si le poste n'est pas ici. */
export function workshopModel(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  ui: WorkshopUiState,
): WorkshopModel | null {
  const look = { content, world };
  const station = stationOf(look, ui.target);
  if (station === null) return null;
  const tabs = station.brick.services;
  const tab = tabs.includes(ui.tab) ? ui.tab : (tabs[0] ?? 'make');
  const lines = (materials: readonly { item: string; count: number }[]): MaterialLine[] =>
    materials.map((m) => ({
      item: m.item,
      name: nameOf(content, m.item),
      need: m.count,
      ...materialCount(look, me, station, m.item),
    }));
  const enough = (list: readonly MaterialLine[]): boolean =>
    list.every((m) => m.pockets + m.chests >= m.need);
  const purse = world.players[me].money;
  const tiles: WorkshopTile[] = [];
  const toolbar = world.players[me].toolbar;
  const order = orderOf(world, me);

  if (tab === 'make') {
    for (const { plan, known } of plansAt(content, world, station, 'make')) {
      const variants = plan.makes.kind === 'furniture' ? plan.makes.variants : [];
      const variant = Math.min(ui.variant, Math.max(0, variants.length - 1));
      const output = planOutput(plan, variant);
      const materials = lines(plan.materials);
      tiles.push({
        ...base(
          plan.id,
          output?.item ?? plan.id,
          plan.name,
          !known ? 'unknown' : enough(materials) ? 'ok' : 'missing',
        ),
        plan: plan.id,
        colors: variants.map((v) => ({ color: v.color, name: nameOf(content, v.item) })),
        series: plan.series,
        materials,
        made: timesMade(world, plan.id),
        work: plan.work,
      });
    }
  } else {
    toolbar.forEach((stack, slot) => {
      const tool = stack === null ? null : (content.items[stack.item]?.tool ?? null);
      if (stack === null || tool === null) return;
      const id = `case-${String(slot)}`;
      const wear = tool.durability === 0 ? null : toolWearRatio(content, stack);
      const name = nameOf(content, stack.item);
      if (tab === 'upgrade') {
        const up = upgradeAt(content, world, station, stack.item);
        if (up === null) return;
        const materials = lines(up.materials);
        const later = up.plan.delay === 'next-day';
        const state: TileState = !isPlanKnown(world, up.plan)
          ? 'unknown'
          : later && order !== null
            ? 'pending'
            : purse < up.cents
              ? 'too-expensive'
              : enough(materials)
                ? 'ok'
                : 'missing';
        tiles.push({
          ...base(id, stack.item, name, state),
          plan: up.plan.id,
          slot,
          materials,
          cents: up.cents,
          wear,
          to: up.to,
          later,
        });
      } else if (tab === 'repair') {
        const price = repairPrice(content, stack);
        if (price === null) return;
        const materials = lines(content.items[stack.item]?.tool?.work?.repair?.items ?? []);
        const state: TileState =
          (wear ?? 1) >= 1
            ? 'sharp'
            : purse < price
              ? 'too-expensive'
              : enough(materials)
                ? 'ok'
                : 'missing';
        tiles.push({ ...base(id, stack.item, name, state), slot, materials, cents: price, wear });
      } else {
        if (tool.durability === 0) return;
        const state: TileState = !CRAFTING.sharpen.kinds.includes(tool.kind)
          ? 'cannot'
          : (wear ?? 1) >= CRAFTING.sharpen.cap
            ? 'sharp'
            : 'ok';
        tiles.push({ ...base(id, stack.item, name, state), slot, cents: 0, wear });
      }
    });
  }
  const focus = tiles.length === 0 ? 0 : Math.min(Math.max(0, ui.focus), tiles.length - 1);
  const detail = tiles[focus] ?? null;
  const variant =
    detail === null || detail.colors.length === 0
      ? 0
      : Math.min(ui.variant, detail.colors.length - 1);
  return {
    station: station.brick.station,
    name: Object.values(content.props).find((p) => p.bricks.includes(station.brick))?.name ?? '',
    tabs,
    tab,
    tiles,
    focus,
    variant,
    detail,
    order,
  };
}
