// Patch 0.12.2, « une icône par chose » (séance du client du 3 novembre): chaque objet, plat, poisson et
// robe de poule a son symbole dans le sprite; aucun objet ne retombe sur un dessin générique; les tables
// d'icônes ne citent que des symboles qui existent; les couleurs des nouveaux dessins sont celles de la
// palette du décor; les fonctions de `icones.ts` ont un repli sûr.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEASONS } from '../../donnees/calendrier';
import { FISH_RARITIES } from '../../etat/peche';
import {
  ACTION_ICONS,
  CATEGORY_ICONS,
  FISH_ICONS,
  HEN_COLORS,
  HEN_ROBE_ICONS,
  HEN_UNKNOWN_ICON,
  INFO_ICONS,
  ITEM_ICONS,
  RARITY_ICONS,
  WEATHER_ICONS,
} from '../config';
import {
  FISH_FALLBACK_ICON,
  INFO_FALLBACK_ICON,
  fishIcon,
  henIcon,
  infoIcon,
  rarityClass,
  rarityIcon,
} from '../icones';
import { contentAndMap } from './aides';

const sprite = readFileSync(
  fileURLToPath(new URL('../../../ui-maquettes/icones.svg', import.meta.url)),
  'utf8',
);
const palettePy = readFileSync(
  fileURLToPath(new URL('../../../assets-src/modeles/palette.py', import.meta.url)),
  'utf8',
);

/** Corps de chaque symbole du sprite, par identifiant. */
const symbols = new Map(
  [...sprite.matchAll(/<symbol id="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/symbol>/g)].map((m) => [
    m[1] ?? '',
    m[2] ?? '',
  ]),
);

/** Dessins génériques: un objet ne doit pas y retomber, sauf l'objet que le dessin représente vraiment. */
const GENERIC = ['parcel', 'plank', 'bread', 'fish', 'gift', 'hen'];
const GENERIC_EXCEPTIONS: Readonly<Record<string, string>> = {
  plank: 'la planche est le sujet même du dessin « plank »',
  bread: 'le pain long est le sujet même du dessin « bread » (le pain chaud a le sien)',
};

/** Symboles d'avant la 0.12.2 dont les teintes ne viennent pas toutes de palette.py (tolérés). */
const LEGACY_COLORS = new Set([
  'watering-can',
  'hen',
  'gift',
  'picture-frame',
  'weather-rain',
  'weather-cloud',
  'ui-coin-aubrin',
  'ui-star',
]);
const palette = new Set([
  ...[...palettePy.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()),
  '#2A2522', // encre
  '#FBF6E9', // papier relevé (jeton.css)
]);

describe('sprite des icônes (0.12.2)', () => {
  const { content, map } = contentAndMap();
  const items = Object.values(content.items);

  it('chaque symbole cité par une table d’icônes existe dans le sprite', () => {
    const cited = [
      ...Object.values(ITEM_ICONS),
      ...Object.values(CATEGORY_ICONS),
      ...Object.values(ACTION_ICONS),
      ...Object.values(WEATHER_ICONS),
      ...Object.values(FISH_ICONS),
      ...Object.values(RARITY_ICONS),
      ...Object.values(HEN_ROBE_ICONS),
      ...Object.values(INFO_ICONS),
      HEN_UNKNOWN_ICON,
      FISH_FALLBACK_ICON,
      INFO_FALLBACK_ICON,
      'parcel',
    ];
    const missing = [...new Set(cited)].filter((id) => !symbols.has(id));
    expect(missing).toEqual([]);
  });

  it('chaque objet de objets.json a sa propre entrée, et la table ne cite que des objets du jeu', () => {
    const ids = items.map((d) => d.id);
    // 0.13: 185 objets (cordeau, parcelle, quêtes des voisins, cadeaux, plats du bourg).
    expect(ids.length).toBe(185);
    expect(ids.filter((id) => ITEM_ICONS[id] === undefined)).toEqual([]);
    expect(Object.keys(ITEM_ICONS).filter((id) => content.items[id] === undefined)).toEqual([]);
  });

  it('aucun objet ne retombe sur un dessin générique (parcel, plank, bread, fish...), sauf exception justifiée', () => {
    const fallen = items
      .filter((d) => GENERIC.includes(ITEM_ICONS[d.id] ?? 'parcel'))
      .filter((d) => GENERIC_EXCEPTIONS[d.id] === undefined)
      .map((d) => `${d.id} -> ${ITEM_ICONS[d.id] ?? '(rien)'}`);
    expect(fallen).toEqual([]);
    for (const [id, why] of Object.entries(GENERIC_EXCEPTIONS)) {
      expect(ITEM_ICONS[id], why).toBe(id);
    }
  });

  it('deux objets différents ne partagent jamais un symbole', () => {
    const owners = new Map<string, string[]>();
    for (const d of items) {
      const icon = ITEM_ICONS[d.id] ?? '';
      owners.set(icon, [...(owners.get(icon) ?? []), d.id]);
    }
    const shared = [...owners]
      .filter(([, list]) => list.length > 1)
      .map(([icon, list]) => `${icon}: ${list.join(', ')}`);
    expect(shared).toEqual([]);
  });

  it('chaque recette du réchaud et de l’établi donne un plat ou un produit à l’icône distincte', () => {
    const recipes = Object.values(content.recipes);
    const stove = recipes
      .filter((r) => r.station === 'stove')
      .map((r) => ITEM_ICONS[r.output.item]);
    expect(stove.length).toBeGreaterThanOrEqual(8);
    expect(new Set(stove).size).toBe(stove.length);
    expect(stove).not.toContain('bread');
    const workbench = recipes
      .filter((r) => r.station === 'workbench')
      .map((r) => ITEM_ICONS[r.output.item]);
    expect(new Set(workbench).size).toBe(workbench.length);
  });

  it('les 22 poissons ont chacun leur silhouette, et chaque rareté son fond et sa classe', () => {
    const fishes = items.filter((d) => d.fish !== null);
    expect(fishes).toHaveLength(22);
    const icons = fishes.map((d) => fishIcon(d.id));
    expect(icons).not.toContain(FISH_FALLBACK_ICON);
    expect(new Set(icons).size).toBe(22);
    for (const d of fishes) expect(ITEM_ICONS[d.id]).toBe(fishIcon(d.id));
    for (const d of fishes) expect(FISH_RARITIES).toContain(d.fish?.rarity);
    expect(new Set(FISH_RARITIES.map(rarityIcon)).size).toBe(FISH_RARITIES.length);
    expect(new Set(FISH_RARITIES.map(rarityClass)).size).toBe(FISH_RARITIES.length);
  });

  it('les six robes de poule ont chacune leur portrait, une robe à trouver montre la silhouette grise', () => {
    const robes = content.settings.hens.care?.colors ?? [];
    expect(robes).toHaveLength(6);
    const icons = robes.map((r) => henIcon(r));
    expect(icons).not.toContain(HEN_UNKNOWN_ICON);
    expect(new Set(icons).size).toBe(6);
    for (const r of robes) {
      expect(henIcon(r, false)).toBe(HEN_UNKNOWN_ICON);
      expect(HEN_COLORS[r]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('les saisons, les coins de pêche de la carte et les soins ont leur icône d’information', () => {
    const zones = (map.fishingZones ?? []).map((z) => z.id);
    expect(zones.length).toBeGreaterThanOrEqual(7);
    for (const key of [...SEASONS, ...zones]) expect(infoIcon(key)).not.toBe(INFO_FALLBACK_ICON);
    for (const fish of items.filter((d) => d.fish !== null)) {
      for (const zone of fish.fish?.zones ?? [])
        expect(infoIcon(zone)).not.toBe(INFO_FALLBACK_ICON);
    }
    const values = Object.values(INFO_ICONS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('les replis sont sûrs: entrée inconnue, symbole qui existe', () => {
    expect(fishIcon('poisson_de_la_0_13')).toBe(FISH_FALLBACK_ICON);
    expect(henIcon('hen_violette')).toBe(HEN_UNKNOWN_ICON);
    expect(infoIcon('marée')).toBe(INFO_FALLBACK_ICON);
    expect(infoIcon('toString')).toBe(INFO_FALLBACK_ICON);
    expect(rarityClass('introuvable')).toBe('lpl-rarity--common');
    expect(rarityIcon('introuvable')).toBe('rarity-common');
    expect(rarityClass('mythic')).toBe('lpl-rarity--mythic');
  });

  it('les couleurs des symboles des objets, poissons, poules et fiches viennent de palette.py', () => {
    const used = new Set([
      ...Object.values(ITEM_ICONS),
      ...Object.values(RARITY_ICONS),
      ...Object.values(HEN_ROBE_ICONS),
      ...Object.values(INFO_ICONS),
      HEN_UNKNOWN_ICON,
    ]);
    const off: string[] = [];
    for (const id of used) {
      if (LEGACY_COLORS.has(id)) continue;
      const colors = new Set(
        [...(symbols.get(id) ?? '').matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()),
      );
      for (const c of colors) if (!palette.has(c)) off.push(`${id}: ${c}`);
    }
    expect(off).toEqual([]);
  });
});
