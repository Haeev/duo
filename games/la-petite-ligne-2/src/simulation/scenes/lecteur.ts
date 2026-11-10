/**
 * Lecteur de scènes (technique 3.3). L'hôte joue la scène temps par temps; son état
 * (`common.story.scene`) part chez l'invité, qui l'affiche en même temps. Rien n'est figé: les
 * joueurs gardent la main, une réplique ne retient jamais plus que `maxLineSeconds`, et une
 * reconnexion reprend au temps en cours (il est dans l'état et dans la sauvegarde). Une scène
 * quittée (changement de lieu) est abandonnée sans être comptée vue: son déclencheur la rejouera.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { BeatDef, GestureDef, SceneDef, SceneRun } from '../../donnees/schemas/scene';
import type { SimContext } from '../noyau/systemes';
import type { RuleContext } from '../regles/conditions';
import { remember } from '../regles/memoire';
import { evaluateStepAll, playersTogether } from '../quetes/conditions';
import { applyStepEffects, type StoryHooks } from '../quetes/effets';
import { sceneKey, sceneSeenOn, storyOf } from '../quetes/faits';
import { STORY } from '../quetes/reglages';

/** Au-delà, une suite de temps instantanés est une faute de données: on reprend au pas suivant. */
const MAX_INSTANT_BEATS = 64;

function other(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

/** Ce qu'il faut d'une scène en cours pour savoir qui tient quel rôle. */
export interface RoleHolder {
  readonly roleA: PlayerIndex;
}

/** Le joueur qui tient un rôle, `null`: l'un ou l'autre. */
export function playerOfRole(run: RoleHolder, role: 'a' | 'b' | 'any'): PlayerIndex | null {
  if (role === 'any') return null;
  return role === 'a' ? run.roleA : other(run.roleA);
}

/** Joueurs à qui s'adresse une réplique. */
export function audienceOf(run: RoleHolder, to: 'both' | 'a' | 'b'): readonly PlayerIndex[] {
  if (to === 'both') return [0, 1];
  const p = playerOfRole(run, to);
  return p === null ? [0, 1] : [p];
}

function sceneDef(sim: SimContext, run: SceneRun): SceneDef | null {
  return sim.content.places[run.place]?.scenes[run.id] ?? null;
}

function start(sim: SimContext, scene: SceneDef, by: PlayerIndex, hooks: StoryHooks): void {
  const story = storyOf(sim.world);
  story.scene = {
    id: scene.id,
    place: sim.world.common.place,
    beat: 0,
    since: sim.world.tick,
    roleA: by,
    read: [false, false],
    parts: [false, false],
    camera: null,
    fade: 'clear',
  };
  sim.touch('common');
  sim.emit({ type: 'scene_started', scene: scene.id, roleA: by });
  sim.emit({ type: 'scene_beat', scene: scene.id, beat: 0 });
  runBeats(sim, hooks);
}

/** Lance une scène du lieu, ou la met en file si une autre se joue. */
export function queueScene(
  sim: SimContext,
  scene: string,
  by: PlayerIndex,
  hooks: StoryHooks,
): boolean {
  const def = sim.content.places[sim.world.common.place]?.scenes[scene];
  if (def === undefined) return false;
  const story = storyOf(sim.world);
  if (story.scene?.id === scene || story.queue.includes(scene)) return false;
  if (story.scene === null && (!def.together || playersTogether(sim.world))) {
    start(sim, def, by, hooks);
    return true;
  }
  if (story.queue.length >= 4) return false;
  story.queue.push(scene);
  sim.touch('common');
  return true;
}

function finish(sim: SimContext, run: SceneRun, completed: boolean): void {
  const story = storyOf(sim.world);
  story.scene = null;
  sim.touch('common');
  if (completed) remember(sim, sceneKey(run.place, run.id), sim.world.common.day, 'duo');
  sim.emit({ type: 'scene_ended', scene: run.id, completed });
}

function nextBeat(sim: SimContext, run: SceneRun): void {
  run.beat += 1;
  run.since = sim.world.tick;
  run.read = [false, false];
  run.parts = [false, false];
  delete run.readAt;
  delete run.gestures;
  sim.touch('common');
  sim.emit({ type: 'scene_beat', scene: run.id, beat: run.beat });
}

/** Avance l'habitant d'un pas vers le point; `true`: arrivé. */
function walk(sim: SimContext, run: SceneRun, who: string, to: string, elapsed: number): boolean {
  const villager = sim.world.places[run.place]?.villagers[who];
  const point = sim.content.places[run.place]?.map.points[to];
  if (villager === undefined || point === undefined) return true;
  const dx = point.x - villager.body.x;
  const dy = point.y - villager.body.y;
  const left = Math.hypot(dx, dy);
  const stride = STORY.villagerWalkSpeed * sim.dt;
  if (left <= stride || elapsed >= STORY.maxWalkSeconds) {
    villager.body.x = point.x;
    villager.body.y = point.y;
    villager.body.speed = 0;
    return true;
  }
  villager.body.x += (dx / left) * stride;
  villager.body.y += (dy / left) * stride;
  villager.body.facing = Math.atan2(dy, dx);
  villager.body.speed = STORY.villagerWalkSpeed;
  return false;
}

/**
 * Suit le geste d'une partie (touche d'action tenue, position du joueur) et dit s'il est réussi
 * maintenant. Chaque début, arrêt ou expiration part en événement `scene_gesture`.
 */
function followGesture(
  sim: SimContext,
  run: SceneRun,
  part: number,
  gesture: GestureDef,
  player: PlayerIndex,
  window: number | undefined,
): boolean {
  run.gestures ??= [
    { down: false, since: null },
    { down: false, since: null },
  ];
  const g = run.gestures[part === 0 ? 0 : 1];
  const tick = sim.world.tick;
  const emit = (state: 'start' | 'stop' | 'expired'): void => {
    sim.touch('common');
    sim.emit({ type: 'scene_gesture', scene: run.id, part, player, state });
  };
  let down: boolean;
  if (gesture.type === 'stand') {
    const at = sim.content.places[run.place]?.map.points[gesture.point];
    const body = sim.world.players[player].body;
    down =
      at !== undefined &&
      Math.hypot(body.x - at.x, body.y - at.y) <= (gesture.radius ?? STORY.reachRadius);
  } else down = sim.inputs[player].act;
  if (down !== g.down) {
    g.down = down;
    // Un appui reste valable après qu'on a lâché la touche; tenir et se tenir s'arrêtent.
    if (gesture.type === 'press' && !down) sim.touch('common');
    else {
      g.since = down ? tick : null;
      emit(down ? 'start' : 'stop');
    }
  }
  if (g.since === null) return false;
  const elapsed = (tick - g.since) * sim.dt;
  if (gesture.type !== 'press') return elapsed >= gesture.seconds;
  if (window !== undefined && elapsed > window) {
    g.since = null;
    emit('expired');
    return false;
  }
  return true;
}

/** Le temps en cours est-il fini ? Applique au passage ce qu'il fait. */
function beatDone(sim: SimContext, run: SceneRun, beat: BeatDef, hooks: StoryHooks): boolean {
  const elapsed = (sim.world.tick - run.since) * sim.dt;
  switch (beat.do) {
    case 'say': {
      const audience = audienceOf(run, beat.to);
      if (audience.every((p) => run.read[p])) return true;
      if (beat.seconds !== null && elapsed >= beat.seconds) return true;
      // Le délai d'un lecteur seul part de sa lecture: l'autre a toujours ce temps pour finir.
      const readFor = (sim.world.tick - (run.readAt ?? run.since)) * sim.dt;
      if (audience.some((p) => run.read[p]) && readFor >= STORY.soloReadSeconds) return true;
      return elapsed >= STORY.maxLineSeconds;
    }
    case 'walk':
      return walk(sim, run, beat.who, beat.to, elapsed);
    case 'emote':
      return true;
    case 'camera':
      run.camera = {
        focus: beat.focus,
        until: sim.world.tick + Math.round(beat.seconds / sim.dt),
      };
      sim.touch('common');
      return true;
    case 'fade':
      if (run.fade !== beat.to) {
        run.fade = beat.to;
        sim.touch('common');
      }
      return elapsed >= beat.seconds;
    case 'wait':
      return elapsed >= beat.seconds;
    case 'await': {
      const window = beat.together;
      beat.parts.forEach((part, i) => {
        const player = playerOfRole(run, part.role);
        const ctx: RuleContext = { world: sim.world, content: sim.content, actor: player };
        // Sans geste, ou acquise hors d'un geste ensemble: la partie ne change plus.
        if (run.parts[i] === true && (part.gesture === undefined || window === undefined)) return;
        const ok =
          (part.gesture === undefined ||
            player === null ||
            followGesture(sim, run, i, part.gesture, player, window)) &&
          evaluateStepAll(ctx, part.done);
        if (ok === run.parts[i]) return;
        run.parts[i] = ok;
        sim.touch('common');
        if (part.gesture !== undefined && player !== null)
          sim.emit({
            type: 'scene_gesture',
            scene: run.id,
            part: i,
            player,
            state: ok ? 'done' : 'lost',
          });
      });
      return beat.parts.every((_, i) => run.parts[i] === true);
    }
    case 'effects':
      applyStepEffects(sim, run.roleA, beat.effects, hooks);
      return true;
  }
}

function runBeats(sim: SimContext, hooks: StoryHooks): void {
  for (let guard = 0; guard < MAX_INSTANT_BEATS; guard++) {
    const run = sim.world.common.story?.scene ?? null;
    if (run === null) return;
    const def = sceneDef(sim, run);
    if (def === null || run.place !== sim.world.common.place) {
      finish(sim, run, false);
      return;
    }
    const beat = def.beats[run.beat];
    if (beat === undefined) {
      finish(sim, run, true);
      return;
    }
    if (!beatDone(sim, run, beat, hooks)) return;
    nextBeat(sim, run);
  }
}

/** Heure dans la fenêtre d'un déclencheur (elle peut passer minuit). */
function inWindow(minutes: number, at: number): boolean {
  const late = (minutes - at + 1440) % 1440;
  return late < STORY.triggerLateMinutes;
}

/** Déclencheurs de monde des scènes du lieu: heure, histoire, présence des deux. */
function checkTriggers(sim: SimContext, hooks: StoryHooks): void {
  const place = sim.content.places[sim.world.common.place];
  if (place === undefined) return;
  const either: RuleContext = { world: sim.world, content: sim.content, actor: null };
  for (const scene of Object.values(place.scenes)) {
    const trigger = scene.trigger;
    if (trigger === null) continue;
    const seen = sceneSeenOn(sim.world, place.def.id, scene.id);
    if (trigger.repeat === 'once' ? seen !== null : seen === sim.world.common.day) continue;
    if (trigger.at !== null && !inWindow(sim.world.minutes, trigger.at)) continue;
    if (scene.together && !playersTogether(sim.world)) continue;
    if (!evaluateStepAll(either, trigger.when)) continue;
    queueScene(sim, scene.id, 0, hooks);
  }
}

/** Un pas: la scène en cours avance, sinon la file ou un déclencheur en lance une. */
export function stepScenes(sim: SimContext, hooks: StoryHooks, checkNow: boolean): void {
  const story = sim.world.common.story ?? null;
  if (story !== null && story.scene === null && story.queue.length > 0) {
    const place = sim.content.places[sim.world.common.place];
    const next = story.queue[0];
    const def = next === undefined ? undefined : place?.scenes[next];
    if (def === undefined) {
      story.queue.shift();
      sim.touch('common');
    } else if (!def.together || playersTogether(sim.world)) {
      story.queue.shift();
      start(sim, def, 0, hooks);
    }
  }
  if ((sim.world.common.story?.scene ?? null) !== null) runBeats(sim, hooks);
  else if (checkNow) checkTriggers(sim, hooks);
}

/** Intention « réplique lue » d'un joueur. */
export function sceneNext(sim: SimContext, player: PlayerIndex, hooks: StoryHooks): void {
  const run = sim.world.common.story?.scene ?? null;
  if (run === null || run.read[player]) return;
  const beat = sceneDef(sim, run)?.beats[run.beat];
  if (beat?.do !== 'say' || !audienceOf(run, beat.to).includes(player)) return;
  if (!run.read.some(Boolean)) run.readAt = sim.world.tick;
  run.read[player] = true;
  sim.touch('common');
  runBeats(sim, hooks);
}
