// 0.13, lot H7, seconde moitié (`docs/jeux/jeu-1/v0-13-habitants.md`, sections 7.1 et 7.3): gestes
// des habitants avec le décor (`gestes-0-13.json`) et réactions aux joueurs. Données cohérentes
// (habitants, habitudes, clips, sons, accessoires), chaque geste atteint par le planning à son
// poste, cap tourné vers son objet, et quelques réactions sur une simulation courte.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gesturesReferences, type GestureDef } from '../src/donnees/gestes-0-13';
import { VillagerGestures, gestureClipAt, headingToFacing } from '../src/etat/gestes-habitants';
import type { Weather, WorldEvent } from '../src/etat/types';
import { hasDedicatedSubstitute } from '../src/rendu/substituts';
import { SCHEDULE_PERIOD_TICKS } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import { placeVillagers } from '../src/simulation/habitants';
import { updateReactions } from '../src/simulation/reactions';
import { contentAndMap, newSim } from './aides';

function glbJson(file: string): { animations?: { name: string }[] } {
  const data = readFileSync(fileURLToPath(new URL(file, import.meta.url)));
  const length = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + length).toString('utf8')) as { animations?: { name: string }[] };
}

const CLIPS = new Set((glbJson('../assets/modeles/personnages.glb').animations ?? []).map((a) => a.name));
const MODELS = new Set(Object.keys(JSON.parse(readFileSync(fileURLToPath(new URL('../assets/modeles/index.json', import.meta.url)), 'utf8')) as Record<string, unknown>));
const SOUNDS = new Set(
  Object.keys(
    (JSON.parse(readFileSync(fileURLToPath(new URL('../assets/son/sons.json', import.meta.url)), 'utf8')) as { sounds: Record<string, unknown> }).sounds,
  ),
);
const WEATHERS: readonly Weather[] = ['sunny', 'cloudy', 'rain'];
const SEARCH_DAYS = 56;

/** Cherche un instant où le planning met l'un de ses habitants au poste du geste, et le geste se joue. */
function reach(sim: Sim, gestures: VillagerGestures, g: GestureDef): { villager: string; day: number; minutes: number } | null {
  const { content, world } = sim;
  for (const who of g.villagers) {
    const def = content.villagers.find((v) => v.id === who);
    for (const entry of def?.schedule ?? []) {
      if (g.habits.length > 0 && (entry.habit === null || !g.habits.includes(entry.habit))) continue;
      if (g.points.length > 0 && !g.points.includes(entry.point)) continue;
      const minutes = Math.max(entry.from + 5, g.from ?? 0);
      for (let day = 1; day <= SEARCH_DAYS; day += 1) {
        for (const weather of WEATHERS) {
          world.clock.day = day;
          world.clock.minutes = minutes;
          world.weather = weather;
          placeVillagers(sim);
          const v = world.villagers.find((x) => x.id === who);
          if (v !== undefined && gestures.gestureOf(v, world)?.id === g.id) return { villager: who, day, minutes };
        }
      }
    }
  }
  return null;
}

describe('gestes des habitants avec le décor (0.13, H7)', () => {
  const { content, map } = contentAndMap();
  const life = content.villageLife;

  it('au moins trente gestes, toutes leurs références dans le contenu, les clips, les sons et les modèles', () => {
    expect(life.gestures.length).toBeGreaterThanOrEqual(30);
    expect(gesturesReferences(life, content.villagers)).toEqual([]);
    for (const g of life.gestures) {
      for (const s of g.steps) expect(CLIPS.has(s.clip), `${g.id}: clip ${s.clip}`).toBe(true);
      if (g.sound !== null) expect(SOUNDS.has(g.sound.id), `${g.id}: son ${g.sound.id}`).toBe(true);
      if (g.prop !== null) expect(MODELS.has(g.prop.model) || hasDedicatedSubstitute(g.prop.model), `${g.id}: ${g.prop.model}`).toBe(true);
      if (g.face?.kind === 'object') {
        const id = g.face.id;
        expect(map.props.some((p) => p.id === id) || map.trees.some((t) => t.id === id), `${g.id}: objet ${id}`).toBe(true);
      }
    }
  });

  it('chaque geste se joue à son poste, au moins un jour des huit premières semaines', () => {
    const sim = newSim();
    // Lucie revenue (sa suite de quêtes), Basile à la recherche du nichoir (« basile_lost »).
    sim.world.flags.push('lucie_back');
    sim.world.quests.push({ id: 'basile_lost', status: 'active', step: 0, startedDay: 1 });
    const gestures = new VillagerGestures(sim.content, sim.map);
    const missed = life.gestures.filter((g) => reach(sim, gestures, g) === null).map((g) => g.id);
    expect(missed).toEqual([]);
  });

  it('tourné vers ce que le geste vise, et la boucle de clips décalée selon l\'habitant', () => {
    const sim = newSim();
    const gestures = new VillagerGestures(sim.content, sim.map);
    const fell = life.gestures.find((g) => g.id === 'barnabe_fell');
    if (fell === undefined) throw new Error('geste absent');
    const found = reach(sim, gestures, fell);
    if (found === null) throw new Error('coupe jamais atteinte');
    const v = sim.world.villagers.find((x) => x.id === 'barnabe');
    if (v === undefined) throw new Error('Barnabé absent');
    const stump = sim.map.props.find((p) => p.id === 'stump_02');
    if (stump === undefined) throw new Error('souche absente');
    const facing = gestures.facingOf(fell, v);
    const cx = (stump.rect?.x ?? stump.pos.x) + (stump.rect?.w ?? 0) / 2;
    const cy = (stump.rect?.y ?? stump.pos.y) + (stump.rect?.h ?? 0) / 2;
    expect(facing).toBeCloseTo(Math.atan2(cy - v.pos.y, cx - v.pos.x), 6);
    expect(headingToFacing(0)).toBeCloseTo(-Math.PI / 2, 9);
    expect(headingToFacing(180)).toBeCloseTo(Math.PI / 2, 9);
    expect(gestureClipAt(fell, 0, 'barnabe')).toMatch(/^(chop|idle)$/);
    const clips = new Set<string>();
    for (let t = 0; t < 12; t += 0.5) clips.add(gestureClipAt(fell, t, 'barnabe'));
    expect([...clips].sort()).toEqual(['chop', 'idle']);
  });
});

describe('réactions des habitants aux joueurs (0.13, H7, section 7.3)', () => {
  function remarks(sim: Sim): Extract<WorldEvent, { type: 'villager_remark' }>[] {
    return sim.events.filter((e): e is Extract<WorldEvent, { type: 'villager_remark' }> => e.type === 'villager_remark');
  }

  /** Un joueur posé près de Firmin à sa cloche (8 h à 18 h), des mises à jour des plannings. */
  function nearFirmin(weather: Weather, minutes = 10 * 60): { sim: Sim; said: string[] } {
    const sim = newSim();
    const { world } = sim;
    world.phase = 'day';
    world.clock.day = 3;
    world.clock.minutes = minutes;
    world.weather = weather;
    placeVillagers(sim);
    const firmin = world.villagers.find((v) => v.id === 'firmin');
    const [p1, p2] = world.characters;
    if (firmin === undefined || p1 === undefined || p2 === undefined) throw new Error('monde incomplet');
    for (const c of world.characters) {
      c.created = true;
      c.status = 'active';
      c.dialogue = null;
      c.menu = null;
      c.inside = null;
    }
    p1.pos = { x: firmin.pos.x + 1.5, y: firmin.pos.y };
    p2.pos = { x: firmin.pos.x + 40, y: firmin.pos.y + 40 };
    const said: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      sim.events.length = 0;
      world.tick = (i + 1) * SCHEDULE_PERIOD_TICKS;
      updateReactions(sim);
      for (const e of remarks(sim)) if (e.villager === 'firmin' && e.to === 'p1') said.push(e.text);
    }
    return { sim, said };
  }

  it('salue au passage, puis parle de la pluie, au plus trois fois par jour', () => {
    const sunny = nearFirmin('sunny').said;
    expect(sunny).toHaveLength(1);
    expect(contentAndMap().content.villageLife.reactions?.greet.stranger).toContain(sunny[0]);
    const rain = nearFirmin('rain').said;
    expect(rain).toHaveLength(2);
    expect(contentAndMap().content.villageLife.reactions?.weather.rain).toContain(rain[0]);
  });

  it('les deux joueurs ensemble près de lui: une remarque pour le duo, une fois par semaine', () => {
    const { sim } = nearFirmin('sunny');
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('joueurs absents');
    p2.pos = { x: p1.pos.x + 1, y: p1.pos.y };
    const texts: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      sim.events.length = 0;
      sim.world.tick += SCHEDULE_PERIOD_TICKS;
      updateReactions(sim);
      texts.push(...remarks(sim).filter((e) => e.villager === 'firmin').map((e) => e.text));
    }
    const together = contentAndMap().content.villageLife.reactions?.together.texts ?? [];
    expect(texts.filter((t) => together.includes(t))).toHaveLength(1);
  });

  it('un objet qu\'il adore en main: il le remarque et le goût s\'écrit au carnet', () => {
    const { content } = contentAndMap();
    const loved = content.villagers.find((v) => v.id === 'firmin')?.tastes.loves[0];
    if (loved === undefined) throw new Error('Firmin n\'adore rien');
    const sim = newSim();
    const { world } = sim;
    world.phase = 'day';
    world.clock.day = 3;
    world.clock.minutes = 10 * 60;
    placeVillagers(sim);
    const firmin = world.villagers.find((v) => v.id === 'firmin');
    const p1 = world.characters[0];
    if (firmin === undefined || p1 === undefined) throw new Error('monde incomplet');
    p1.created = true;
    p1.status = 'active';
    p1.inside = null;
    p1.pos = { x: firmin.pos.x + 1, y: firmin.pos.y };
    p1.bag[p1.selected] = { item: loved, count: 1, quality: 'ordinary' };
    world.tick = SCHEDULE_PERIOD_TICKS;
    updateReactions(sim);
    expect(remarks(sim).map((e) => e.villager)).toContain('firmin');
    expect(world.tastesKnown.firmin?.[loved]).toBe('loves');
  });

  it('une prise rare sous ses yeux, puis une pièce de tenue neuve: une remarque chacune, une seule fois', () => {
    const { sim } = nearFirmin('sunny');
    const p1 = sim.world.characters[0];
    if (p1 === undefined) throw new Error('joueur absent');
    const said = (): string[] => {
      const out: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        sim.world.tick += SCHEDULE_PERIOD_TICKS;
        updateReactions(sim);
        out.push(...remarks(sim).filter((e) => e.villager === 'firmin').map((e) => e.text));
        sim.events.length = 0;
      }
      return out;
    };
    sim.events.length = 0;
    sim.events.push({ type: 'caught', by: 'p1', item: 'fish_trout', rarity: 'rare' });
    const catchTexts = said();
    expect(catchTexts).toHaveLength(1);
    expect(catchTexts[0]).toMatch(/^[A-ZÀ-Ý]/);
    // Firmin est à Connaissance au moins pour les compliments de tenue.
    sim.world.bonds.firmin = 300;
    p1.appearance.wear.hat = 'nouveau_chapeau_essai';
    const outfit = contentAndMap().content.villageLife.reactions?.outfit.texts ?? [];
    expect(said().filter((t) => outfit.includes(t))).toHaveLength(1);
  });
});
