// Verrous d'histoire et zones (lot simulation, mission M2): sur la carte générée d'Aubrune, rien
// d'une zone fermée n'est atteignable verrous fermés, tout l'est verrous ouverts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { MapSchema } from '../src/donnees/schemas/lieu';
import { reachableCells } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { insidePolygon } from '../src/simulation/lieux/zones';
import { closedLocks, reachMask, zoneViews } from '../src/simulation/lieux/index';
import { planToMap } from '../outils/plan-vers-lieu';
import { dataFiles, newSim } from './aides';

const PLAN = fileURLToPath(
  new URL('../../../docs/jeux/jeu-1/refonte/carte-aubrune/plan.json', import.meta.url),
);

function aubrune(): ReturnType<typeof newSim> {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8')) as unknown;
  const { map } = planToMap(plan, { place: 'aubrune', annex: 48 });
  const files = dataFiles() as Record<string, Record<string, unknown>>;
  files['lieux/aubrune/carte.json'] = v.parse(MapSchema, JSON.parse(JSON.stringify(map)));
  // La grille seule, telle que l'outil la produit: les intérieurs livrés (portes vers la carte
  // assemblée) n'ont pas leur porte d'arrivée ici. `assembler_lieu.py` prouve le reste.
  for (const path of Object.keys(files))
    if (path.startsWith('lieux/aubrune/interieurs/')) Reflect.deleteProperty(files, path);
  files['lieux/aubrune/lieu.json'] = {
    schema: 1,
    id: 'aubrune',
    name: 'Aubrune',
    station: { arrival: 'quai', platform: 'quai', platformRadius: 3 },
    // On arrive à Aubrune par la fin du prologue (effet `travel_to`), sans ligne en retour.
    links: [],
    activities: [],
    music: null,
  };
  const settings = files['commun/reglages.json'];
  if (settings === undefined) throw new Error('réglages absents');
  settings.start = { ...(settings.start as object), place: 'aubrune' };
  return newSim(loadContent(files));
}

describe('verrous d’Aubrune (carte générée)', () => {
  const sim = aubrune();
  const place = sim.content.places.aubrune;
  if (place === undefined) throw new Error('Aubrune absente');
  const zones = place.map.zones ?? {};
  const { width } = place.map;
  const arrival = place.map.points.quai ?? { x: 0, y: 0 };

  /** Cases atteintes depuis le quai, avec les obstacles de la simulation (verrous compris). */
  function reached(): Set<number> {
    const b = currentBlockers(sim.content, sim.world);
    if (b === null) throw new Error('obstacles absents');
    return reachableCells(b, arrival.x, arrival.y);
  }

  /** Cases atteintes par zone d'un acte suivant (l'acte 1 est ouvert dès le départ). */
  function reachedInLaterActs(cells: Set<number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const i of cells) {
      const x = (i % width) + 0.5;
      const y = Math.floor(i / width) + 0.5;
      // La première zone qui contient la case l'emporte, comme à la génération.
      const id = Object.keys(zones).find((z) => insidePolygon(x, y, zones[z]?.polygon ?? []));
      if (id !== undefined && (zones[id]?.act ?? 1) > 1) out[id] = (out[id] ?? 0) + 1;
    }
    return out;
  }

  it('verrous fermés: aucune zone d’un acte suivant n’est ouverte, ni atteinte au-delà de ses lisières', () => {
    expect(closedLocks(sim).size).toBe(12);
    const views = zoneViews(sim);
    for (const z of views) expect([z.id, z.open]).toEqual([z.id, z.act === 1]);
    const leaks = reachedInLaterActs(reached());
    process.stdout.write(
      `cases des actes suivants atteintes, verrous fermés: ${JSON.stringify(leaks)}\n`,
    );
    // Seul le ponton du premier acte, qui avance sur la rivière (zone « r »), mord sur une zone
    // suivante: ses cases appartiennent au premier acte à la génération. Rien d'autre.
    expect(leaks).toEqual({ r: 11 });
  });

  it('verrous ouverts (faits « aubrune.verrou.<id> »): toutes les zones et tous les nœuds sont atteints', () => {
    for (const id of Object.keys(place.map.locks ?? {}))
      sim.world.progress.memory[`aubrune.verrou.${id}`] = { v: true, by: 'duo', day: 1 };
    expect(closedLocks(sim).size).toBe(0);
    for (const z of zoneViews(sim)) {
      expect([z.id, z.open]).toEqual([z.id, true]);
      expect(z.reachable / z.cells, z.id).toBeGreaterThan(0.95);
    }
    const cells = reached();
    const cut = Object.entries(place.map.graph?.nodes ?? {})
      .filter(([, p]) => !cells.has(Math.floor(p.y) * width + Math.floor(p.x)))
      .map(([id]) => id);
    // Plan version 2: la vanne n'est plus sur l'eau, tous les nœuds sont atteints.
    expect(cut).toEqual([]);
    const mask = reachMask(sim);
    expect(mask?.[Math.floor(arrival.y) * width + Math.floor(arrival.x)]).toBe(1);
  });
});
