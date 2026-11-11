// Règles de pose dans la vraie maison du garde d'Aubrune: un logement en plusieurs morceaux
// (rez-de-chaussée, étage et cave sont des intérieurs séparés, le jardin est dehors). Le passage
// libre se juge dans le morceau où l'on pose, par rapport à ce qui communiquait déjà.
import { describe, expect, it } from 'vitest';
import { housingPart, placementRefusal, type Candidate } from '../src/simulation/logement/pose';
import type { Sim } from '../src/simulation/noyau/pas';
import { newSim } from './aides';
import { contentWith, wait } from './aides-l3';

const HOUSE = 'maison-du-garde';

/** Aubrune, la salle restaurée (acte 1), le reste en ruine. */
function aubrune(restored: readonly string[] = ['salle']): Sim {
  const content = contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
    settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
  });
  const sim = newSim(content);
  wait(sim, 1 / 30);
  const state = sim.world.places.aubrune?.housing?.[HOUSE];
  if (state === undefined) throw new Error('maison absente');
  for (const id of restored) {
    const room = state.rooms[id];
    if (room === undefined) throw new Error(`pièce absente: ${id}`);
    room.state = 'restored';
    sim.world.progress.memory[`aubrune.${HOUSE}.${id}`] = { v: 'restored', by: 'duo', day: 1 };
  }
  return sim;
}

function refusalOf(sim: Sim, candidate: Candidate): string | null {
  const place = sim.content.places.aubrune;
  const state = sim.world.places.aubrune;
  const housing = place?.housings[HOUSE];
  if (place === undefined || state === undefined || housing === undefined) throw new Error('lieu');
  return placementRefusal({
    content: sim.content,
    place,
    state,
    world: sim.world,
    housing,
    candidate,
    exclude: new Set(),
  });
}

describe('pose dans la maison du garde', () => {
  it('le morceau montré est celui où l’on se tient: rez-de-chaussée, cave, jardin', () => {
    const sim = aubrune();
    const housing = sim.content.places.aubrune?.housings[HOUSE];
    const state = sim.world.places.aubrune?.housing?.[HOUSE];
    if (housing === undefined) throw new Error('maison absente');
    const ids = (x: number, y: number): string[] =>
      housingPart(housing, state, x, y)
        .map((rect) => housing.rooms.find((r) => r.area === rect)?.id ?? 'jardin')
        .sort();
    // Dans la salle: les quatre pièces du rez-de-chaussée, ni la cave, ni le jardin, ni l'étage
    // (pas encore bâti, donc absent).
    expect(ids(22.5, 212.5)).toEqual(['chambre', 'cuisine', 'salle', 'troisieme-piece']);
    expect(ids(42, 212)).toEqual(['cave']);
    expect(ids(165, 122)).toEqual(['jardin']);
  });

  it('un meuble solide se pose dans la salle: les autres morceaux et les meubles à venir ne comptent pas', () => {
    const sim = aubrune();
    // Au milieu de la salle, loin des portes: rien ne s'y oppose.
    expect(refusalOf(sim, { type: 'tabouret-miel', x: 21.5, y: 213.5, rotation: 0 })).toBeNull();
    // À la place de la future cuisinière (absente tant que la cuisine n'est pas faite): la pièce
    // n'est pas prête, mais ce n'est pas un chevauchement avec un meuble qui n'existe pas.
    expect(refusalOf(sim, { type: 'tabouret-miel', x: 23.5, y: 216.5, rotation: 0 })).toBe(
      'room-not-ready',
    );
    expect(refusalOf(sim, { type: 'tabouret-miel', x: 21, y: 210.5, rotation: 0 })).toBe('overlap');
  });

  it('refuse un lit dont aucun côté ne s’atteint, l’accepte dès qu’un côté se libère', () => {
    const sim = aubrune(['salle', 'chambre']);
    const state = sim.world.places.aubrune;
    if (state === undefined) throw new Error('lieu');
    const put = (x: number, y: number): string => {
      const id = `pose-${String(state.nextPlacedId++)}`;
      state.placed.push({ id, type: 'tabouret-miel', x, y, rotation: 0 });
      state.objects[id] = {};
      return id;
    };
    // Un lit dans le coin nord-ouest de la chambre (14 à 15; 210 à 212): on y vient par l'est ou
    // par le sud. Trois tabourets bouchent tout son pourtour.
    const bed: Candidate = { type: 'lit-simple', x: 14.5, y: 211, rotation: 0 };
    expect(refusalOf(sim, bed)).toBeNull();
    put(15.5, 210.5);
    put(15.5, 211.5);
    const last = put(14.5, 212.5);
    expect(refusalOf(sim, bed)).toBe('blocks-path');
    state.placed = state.placed.filter((p) => p.id !== last);
    expect(refusalOf(sim, bed)).toBeNull();
  });
});
