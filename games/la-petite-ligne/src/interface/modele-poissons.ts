/**
 * Onglet « Poissons » du carnet (pêche 0.12, section 7.4): modèle pur, lu dans le carnet commun du
 * duo (`world.fishing.log`). Rien de ce que voit le seul guetteur n'y figure.
 */
import { FISH_RARITIES, type FishRarity, rarityScales } from '../etat/peche';
import type { ReadonlyWorld } from '../etat/types';
import { dialogueDone } from '../etat/dialogues-faits';
import type { UiContext } from './contexte';
import { characterOf } from './contexte';

export interface FishEntryModel {
  id: string;
  name: string;
  caught: boolean;
  /** Description après la première prise, sinon l'indice (ou rien pour un grand dont personne n'a parlé). */
  text: string;
  /** Lignes de la fiche (vides avant la première prise). */
  facts: string[];
  /** Taille relative de la silhouette (longueur de l'ombre, m). */
  shadowLength: number;
}

export interface FishRowModel {
  rarity: FishRarity;
  title: string;
  scales: number;
  scalesLabel: string;
  entries: FishEntryModel[];
}

export interface FishPageModel {
  count: string;
  here: string | null;
  rows: FishRowModel[];
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${String(h)} h` : `${String(h)} h ${String(m).padStart(2, '0')}`;
}

/** Le modèle de l'onglet pour le joueur `ctx.me`. */
export function fishPageModel(world: ReadonlyWorld, ctx: UiContext): FishPageModel {
  const t = ctx.texts.extra.fish;
  const zones = ctx.map.fishingZones ?? [];
  const zoneName = (id: string): string => zones.find((z) => z.id === id)?.name ?? id;
  const sizes = ctx.content.settings.fishing?.rules.shadows.sizes ?? { small: 0.3, medium: 0.5, large: 0.8, huge: 1.2 };
  const log = world.fishing.log;
  const fishes = Object.values(ctx.content.items).filter((d) => d.fish !== null);
  const caught = fishes.filter((d) => log[d.id] !== undefined).length;
  const me = characterOf(world, ctx.me);
  let here: string | null = null;
  if (me !== null && me.inside === null) {
    const zone = zones.find((z) => z.rects.some((r) => me.pos.x >= r.x - 3 && me.pos.y >= r.y - 3 && me.pos.x < r.x + r.w + 3 && me.pos.y < r.y + r.h + 3));
    if (zone !== undefined) here = ctx.t(t.here, { zone: zone.name });
  }
  const nameOf = (id: string): string => world.characters.find((c) => c.id === id)?.name ?? id;
  const rows = FISH_RARITIES.map((rarity): FishRowModel => {
    const scales = rarityScales(rarity);
    const entries = fishes
      .filter((d) => d.fish?.rarity === rarity)
      .map((d): FishEntryModel => {
        const fish = d.fish;
        const entry = log[d.id];
        if (fish === null) return { id: d.id, name: d.name, caught: false, text: '', facts: [], shadowLength: 0 };
        const shadowLength = sizes[fish.shadow];
        if (entry === undefined) {
          const rumor = fish.grand?.rumorDialogue ?? null;
          const locked = fish.grand !== null && (rumor === null || !dialogueDone(world.dialoguesDone, rumor));
          return { id: d.id, name: t.unknown, caught: false, text: locked ? ctx.t(t.hintLocked) : ctx.t(fish.hint), facts: [], shadowLength };
        }
        const list = (items: readonly string[]): string => items.join(', ');
        const facts = [
          ctx.t(t.zones, { list: list(fish.zones.map(zoneName)) }),
          ctx.t(t.seasons, { list: list(fish.seasons.map((s) => t.seasonNames[s])) }),
          ctx.t(t.hours, { list: list(fish.hours.map(([a, b]) => `${hhmm(a)} à ${hhmm(b)}`)) }),
        ];
        if (fish.favorite.length > 0) facts.push(ctx.t(t.favorite, { list: list(fish.favorite.map((f) => t.favorites[f])) }));
        const price = d.sellPrice === null ? null : ctx.t(ctx.texts.game.ui.hud.purse, { amount: d.sellPrice });
        facts.push(fish.released || price === null ? ctx.t(t.released) : ctx.t(t.price, { price }));
        facts.push(ctx.t(t.caught, { count: entry.count }));
        facts.push(ctx.t(t.record, { cm: entry.record.cm, name: nameOf(entry.record.by), day: entry.record.day }));
        const first = ctx.t(t.first, { day: entry.first.day, zone: zoneName(entry.first.zone) });
        facts.push(entry.first.together ? `${first}, ${ctx.t(t.together)}` : first);
        return { id: d.id, name: d.name, caught: true, text: ctx.t(fish.description), facts, shadowLength };
      });
    return { rarity, title: ctx.t(t.rarities[rarity]), scales, scalesLabel: ctx.t(t.scalesLabel, { count: scales }), entries };
  });
  return { count: ctx.t(t.count, { caught, total: fishes.length }), here, rows };
}
