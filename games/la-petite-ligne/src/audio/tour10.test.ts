// Sons du tour 10 (son.md 4.8): catalogue (intérieurs par bâtiment, ru), déclencheurs lus dans
// l'état (rideaux, récréation, coupe au salon, passerelle) et étouffement de l'autre joueur.
import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { newSim } from '../../tests/aides';
import { seasonOfDay, weekdayOf } from '../donnees/calendrier';
import type { LoopWish, SoundRequest, TriggerContext } from './declencheurs';
import { StateWatcher, soundsForEvent } from './declencheurs';
import { parseCatalogue } from './catalogue';
import { AUDIO_SETTINGS } from './reglages';

const catalogue = parseCatalogue(soundsFile);

function setup(): { sim: ReturnType<typeof newSim>; ctx: TriggerContext; watcher: StateWatcher } {
  const sim = newSim();
  sim.world.phase = 'day';
  const ctx: TriggerContext = {
    world: sim.world,
    local: 'p1',
    content: sim.content,
    map: sim.map,
    peerDb: catalogue.peerDb,
    hasSound: (id) => catalogue.sounds.has(id),
  };
  return { sim, ctx, watcher: new StateWatcher(AUDIO_SETTINGS, createRandom(3)) };
}

function frame(watcher: StateWatcher, ctx: TriggerContext): { out: SoundRequest[]; loops: LoopWish[] } {
  const out: SoundRequest[] = [];
  const loops: LoopWish[] = [];
  watcher.update(ctx, 1 / 30, 0, out, loops);
  return { out, loops };
}

describe('catalogue du tour 10', () => {
  it('lit l étouffement et l ambiance de chaque bâtiment, et les sources du ru', () => {
    const salon = catalogue.interiors.buildings.get('salon');
    expect(salon?.roomTone).toBe('room-tone-salon');
    expect(salon?.lowpassHz).toBe(1300);
    expect(catalogue.interiors.buildings.get('grocery')?.roomTone).toBe('room-tone-shop');
    expect(catalogue.interiors.peer).toEqual({ lowpassHz: 900, db: -8 });
    const stream = catalogue.stream;
    expect(stream?.sound).toBe('stream-ru');
    // Du bois (y 2) à l'Aubrune (y 37), tous les 8 m; la source du gué renforcée de 3 dB.
    expect(stream?.sources.length).toBe(5);
    expect(stream?.sources.filter((s) => s.gainDb === 3)).toHaveLength(1);
  });
});

describe('déclencheurs du tour 10', () => {
  it('rideaux: la première variante pour ouvrir, la seconde pour fermer', () => {
    const { sim, ctx, watcher } = setup();
    sim.world.furniture.push({ id: 'r1', item: 'curtains_blue', cell: { cx: 7, cy: 22 }, rotation: 0, placedBy: 'p1', window: 'window_1' });
    frame(watcher, ctx);
    const piece = sim.world.furniture.find((f) => f.id === 'r1');
    if (piece !== undefined) piece.closed = true;
    const closing = frame(watcher, ctx).out.filter((r) => r.sound === 'curtain-draw');
    expect(closing.map((r) => r.variant)).toEqual([1]);
    if (piece !== undefined) delete piece.closed;
    expect(frame(watcher, ctx).out.filter((r) => r.sound === 'curtain-draw').map((r) => r.variant)).toEqual([0]);
  });

  it('récréation à 10 h 30 un jour d école d automne, pas le dimanche', () => {
    const { sim, ctx, watcher } = setup();
    let day = 1;
    while (!(seasonOfDay(sim.content.settings, day) === 'autumn' && weekdayOf(day) === 2)) day += 1;
    sim.world.clock.day = day;
    sim.world.clock.minutes = 10 * 60 + 29;
    frame(watcher, ctx);
    frame(watcher, ctx);
    sim.world.clock.minutes = 10 * 60 + 31;
    expect(frame(watcher, ctx).out.map((r) => r.sound)).toContain('school-recess');
    sim.world.clock.day = day + 5; // dimanche
    sim.world.clock.minutes = 14 * 60;
    frame(watcher, ctx);
    sim.world.clock.minutes = 15 * 60 + 1;
    expect(frame(watcher, ctx).out.map((r) => r.sound)).not.toContain('school-recess');
  });

  it('coupe au salon: les ciseaux puis la révélation; pas hors du salon', () => {
    const { sim, ctx, watcher } = setup();
    const p1 = sim.world.characters[0];
    if (p1 === undefined) throw new Error('p1');
    p1.inside = 'salon';
    frame(watcher, ctx);
    frame(watcher, ctx);
    p1.appearance = { ...p1.appearance, hair: 12 };
    const sounds = frame(watcher, ctx).out.map((r) => r.sound);
    expect(sounds.filter((s) => s === 'scissors-snip')).toHaveLength(3);
    expect(sounds).toContain('hair-reveal');
    p1.inside = null;
    p1.appearance = { ...p1.appearance, hair: 3 };
    expect(frame(watcher, ctx).out.map((r) => r.sound)).not.toContain('scissors-snip');
  });

  it('pas sur la passerelle du ru; l autre joueur dans un autre bâtiment est étouffé', () => {
    const { sim, ctx } = setup();
    const p2 = sim.world.characters[1];
    if (p2 === undefined) throw new Error('p2');
    const footbridge = sim.map.crossings.find((c) => c.kind === 'footbridge');
    const p1 = sim.world.characters[0];
    if (footbridge === undefined || p1 === undefined) throw new Error('passerelle');
    const watcher = new StateWatcher(AUDIO_SETTINGS, createRandom(5));
    p1.created = true;
    p1.status = 'active';
    p1.inside = null;
    p1.pos = { x: footbridge.rect.x + 1, y: footbridge.rect.y + 1 };
    p1.speed = 3;
    const steps = new Set<string>();
    for (let i = 0; i < 60; i += 1) for (const r of frame(watcher, ctx).out) steps.add(r.sound);
    expect(steps).toContain('footbridge-steps');
    // Un événement de l'autre joueur, dans la mercerie, entendu de dehors: étouffé.
    p2.inside = 'salon';
    const out: SoundRequest[] = [];
    soundsForEvent({ type: 'ate', by: 'p2', item: 'bread' }, ctx, AUDIO_SETTINGS, out, { morning: false, wentToBed: false, demoEnded: false, hensFed: false });
    expect(out.find((r) => r.sound === 'eat')?.muffled).toBe(true);
    p2.inside = null;
    const open: SoundRequest[] = [];
    soundsForEvent({ type: 'ate', by: 'p2', item: 'bread' }, ctx, AUDIO_SETTINGS, open, { morning: false, wentToBed: false, demoEnded: false, hensFed: false });
    expect(open.find((r) => r.sound === 'eat')?.muffled).toBeUndefined();
  });
});
