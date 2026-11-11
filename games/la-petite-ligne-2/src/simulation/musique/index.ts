/**
 * Système « musique jouée », chez l'hôte (cahier 4.7). À un endroit où jouer (brique `perform`),
 * instrument en main, un joueur ouvre le cahier de fanfare; l'autre peut le rejoindre pour un
 * duo. L'air se joue sur la machine de chacun (`local.ts`), qui juge ses frappes sur sa propre
 * horloge; l'hôte tient l'horloge de l'air en pas de simulation, valide chaque note annoncée,
 * retient les auditeurs, puis donne le mot de la fin et ce qui va avec.
 *
 * Un air dure moins d'une minute: les airs en cours ne sont ni sauvegardés ni transmis, ils
 * vivent à côté du monde et l'invité les suit par les événements. Ce qui reste (meilleur mot,
 * chapeau du jour, amitié) est écrit en faits de mémoire: ni la sauvegarde ni l'état transmis
 * ne changent de forme.
 */
import type { AirScore } from '../../donnees/schemas/air';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { WorldState } from '../../etat/monde';
import { modifiersOf } from '../besoins/jauges';
import { isFound } from '../collections/registre';
import { addBond } from '../dialogues/amitie';
import { holdAudience } from '../habitants/ecoute';
import { showEmote, villagerFactKey } from '../habitants/presence';
import { SIM_DT } from '../noyau/constantes';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { playerFactKey, recall, remember } from '../regles/memoire';
import { earn } from '../sac/argent';
import type { MusicResult, VoiceId } from './evenements';
import { accuracyOf, judge, ratingOf, tallyOf, windowScaleOf, windowsOf } from './jugement';
import {
  bestKey,
  bestRating,
  heldInstrument,
  instrumentPlays,
  knownAirs,
  leadMs,
  notesOf,
  voicesFor,
} from './lecture';
import { MUSIC, type AssistLevel, type Rating, type Verdict } from './reglages';

interface Member {
  assist: AssistLevel;
  voice: VoiceId;
  readonly verdicts: (Verdict | null)[];
}

interface Recital {
  readonly target: string;
  readonly x: number;
  readonly y: number;
  leader: PlayerIndex;
  readonly members: [Member | null, Member | null];
  /** L'air en cours, `null` tant que le meneur choisit. */
  playing: {
    readonly air: string;
    readonly score: AirScore;
    readonly startTick: number;
    readonly endTick: number;
    /** Secondes d'écoute de chaque habitant. */
    readonly heard: Map<string, number>;
    nextAudienceTick: number;
  } | null;
}

interface Stage {
  place: string;
  recitals: Recital[];
}

const stages = new WeakMap<WorldState, Stage>();

function stageOf(world: WorldState): Stage {
  let stage = stages.get(world);
  if (stage?.place !== world.common.place) {
    stage = { place: world.common.place, recitals: [] };
    stages.set(world, stage);
  }
  return stage;
}

function recitalWith(world: WorldState, player: PlayerIndex): Recital | null {
  return stageOf(world).recitals.find((r) => r.members[player] !== null) ?? null;
}

/** Ce que fait un joueur à l'instrument (lecture pour les tests et l'outillage de l'hôte). */
export function recitalOf(
  world: WorldState,
  player: PlayerIndex,
): {
  readonly target: string;
  readonly leader: PlayerIndex;
  readonly air: string | null;
  readonly startTick: number | null;
  readonly voice: VoiceId;
  readonly verdicts: readonly (Verdict | null)[];
} | null {
  const recital = recitalWith(world, player);
  const member = recital?.members[player] ?? null;
  if (recital === null || member === null) return null;
  return {
    target: recital.target,
    leader: recital.leader,
    air: recital.playing?.air ?? null,
    startTick: recital.playing?.startTick ?? null,
    voice: member.voice,
    verdicts: member.verdicts,
  };
}

function refuse(sim: SimContext, player: PlayerIndex, reason: string, target: string | null): void {
  sim.emit({ type: 'refused', player, reason, target });
}

function other(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

/** Brique `perform`: s'installer à cet endroit, ou rejoindre celui qui y tient déjà le cahier. */
export function sitIn(
  sim: SimContext,
  player: PlayerIndex,
  target: { readonly id: string; readonly x: number; readonly y: number },
): void {
  if (recitalWith(sim.world, player) !== null) return;
  const stage = stageOf(sim.world);
  let recital = stage.recitals.find((r) => r.target === target.id) ?? null;
  if ((recital?.playing ?? null) !== null) {
    refuse(sim, player, 'music-playing', target.id);
    return;
  }
  if (recital === null) {
    recital = {
      target: target.id,
      x: target.x,
      y: target.y,
      leader: player,
      members: [null, null],
      playing: null,
    };
    stage.recitals.push(recital);
  }
  recital.members[player] = { assist: 0, voice: 'solo', verdicts: [] };
  sim.emit({
    type: 'music_opened',
    player,
    target: target.id,
    leader: recital.leader,
    airs: knownAirs(sim.content, sim.world),
  });
}

function leave(sim: SimContext, player: PlayerIndex): void {
  const stage = stageOf(sim.world);
  const recital = recitalWith(sim.world, player);
  if (recital === null) return;
  recital.members[player] = null;
  sim.emit({ type: 'music_closed', player, target: recital.target });
  const mate = other(player);
  if (recital.members[mate] === null) {
    stage.recitals = stage.recitals.filter((r) => r !== recital);
    return;
  }
  // Le meneur parti avant l'air, l'autre prend le cahier.
  if (recital.playing === null && recital.leader === player) {
    recital.leader = mate;
    sim.emit({
      type: 'music_opened',
      player: mate,
      target: recital.target,
      leader: mate,
      airs: knownAirs(sim.content, sim.world),
    });
  }
}

function go(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'music_go' }>,
): void {
  const recital = recitalWith(sim.world, player);
  if (recital?.playing !== null || recital.leader !== player) return;
  const score = sim.content.airs[intent.air]?.score;
  if (score === undefined) {
    refuse(sim, player, 'air-not-ready', recital.target);
    return;
  }
  if (!isFound(sim.world, intent.air)) {
    refuse(sim, player, 'air-unknown', recital.target);
    return;
  }
  for (const p of [0, 1] as const) {
    if (recital.members[p] === null) continue;
    const held = heldInstrument(sim.content, sim.world, p);
    if (held === null || !instrumentPlays(sim.content, held.instrument, intent.air)) {
      refuse(sim, player, 'instrument-too-simple', recital.target);
      return;
    }
  }
  const voices = voicesFor(score, recital.leader, [
    recital.members[0] !== null,
    recital.members[1] !== null,
  ]);
  for (const p of [0, 1] as const) {
    const member = recital.members[p];
    const voice = voices[p];
    if (member === null || voice === null) continue;
    member.voice = voice;
    member.verdicts.length = 0;
  }
  const startTick = sim.world.tick + Math.round(leadMs(score) / 1000 / SIM_DT);
  recital.playing = {
    air: intent.air,
    score,
    startTick,
    endTick: startTick + Math.round((score.lengthMs + MUSIC.tailMs) / 1000 / SIM_DT),
    heard: new Map(),
    nextAudienceTick: sim.world.tick,
  };
  sim.emit({
    type: 'music_started',
    target: recital.target,
    air: intent.air,
    leader: recital.leader,
    voices,
    startTick,
    startAtMs: intent.startAtMs,
  });
}

/** Une note annoncée par la machine du joueur: l'hôte refait le jugement avec ses propres réglages. */
function note(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'music_note' }>,
): void {
  const recital = recitalWith(sim.world, player);
  const member = recital?.members[player] ?? null;
  const playing = recital?.playing ?? null;
  if (member === null || playing === null) return;
  const written = notesOf(playing.score, member.voice)[intent.index];
  if (written === undefined || (member.verdicts[intent.index] ?? null) !== null) return;
  const scale = windowScaleOf(member.assist, modifiersOf(sim.content, sim.world, player).minigame);
  let verdict = judge(intent.offsetMs, intent.lane === written[1], windowsOf(scale));
  // L'horloge de l'air de l'hôte fait foi: une note annoncée bien avant ou bien après son heure
  // n'a pas pu être jouée là, elle compte comme manquée.
  const hostMs = (sim.world.tick - playing.startTick) * SIM_DT * 1000;
  const playedMs = written[0] + (intent.offsetMs ?? 0);
  if (hostMs < playedMs - MUSIC.hostSlack.early || hostMs > playedMs + MUSIC.hostSlack.late)
    verdict = 'missed';
  member.verdicts[intent.index] = verdict;
  sim.emit({ type: 'music_note', player, index: intent.index, verdict });
}

/** Les habitants proches s'arrêtent et écoutent; l'hôte compte leur temps d'écoute. */
function gatherAudience(sim: SimContext, recital: Recital): void {
  const playing = recital.playing;
  const place = sim.world.places[sim.world.common.place];
  if (playing === null || place === undefined || sim.world.tick < playing.nextAudienceTick) return;
  const every = Math.max(1, Math.round(MUSIC.audience.everySeconds / SIM_DT));
  playing.nextAudienceTick = sim.world.tick + every;
  const facing: PlayerIndex =
    recital.members[recital.leader] !== null ? recital.leader : other(recital.leader);
  for (const [id, villager] of Object.entries(place.villagers)) {
    if (villager.life !== undefined && villager.life.presence !== 'here') continue;
    if (villager.talkingWith !== null) continue;
    const distance = Math.hypot(villager.body.x - recital.x, villager.body.y - recital.y);
    if (distance > MUSIC.audience.radius) continue;
    holdAudience(sim.world, id, facing, sim.world.tick + every * 2);
    if (sim.world.tick >= playing.startTick)
      playing.heard.set(id, (playing.heard.get(id) ?? 0) + every * SIM_DT);
  }
}

/** Le mot de la fin, le chapeau, l'amitié des auditeurs: l'air est toujours allé au bout. */
function finish(sim: SimContext, recital: Recital): void {
  const playing = recital.playing;
  if (playing === null) return;
  const day = sim.world.common.day;
  const place = sim.world.places[sim.world.common.place];
  const listeners = [...playing.heard.entries()]
    .filter(([, seconds]) => seconds >= MUSIC.audience.minSeconds)
    .map(([id]) => id);
  const tallies = ([0, 1] as const).map((p) => {
    const member = recital.members[p];
    if (member === null) return null;
    const tally = tallyOf(member.verdicts, notesOf(playing.score, member.voice).length);
    return { tally, rating: ratingOf(accuracyOf(tally)) };
  });
  const ratings = tallies.flatMap((t) => (t === null ? [] : [t.rating]));
  const duo = ratings.length === 2;
  const together = duo && ratings.every((r) => r >= MUSIC.duo.minRating);
  // Le mot commun: à deux, celui du moins assuré (on réussit ensemble).
  const rating = ratings.reduce<Rating>((low, r) => (r < low ? r : low), 3);
  const factor = together ? MUSIC.duo.bonus : 1;
  const results: [MusicResult | null, MusicResult | null] = [null, null];
  for (const p of [0, 1] as const) {
    const mine = tallies[p];
    if (mine === null || mine === undefined) continue;
    let cents = 0;
    const hatKey = playerFactKey(MUSIC.memory.hat, p);
    const perListener = MUSIC.hat.centsPerListener[mine.rating];
    if (listeners.length > 0 && perListener > 0 && recall(sim.world, hatKey)?.day !== day) {
      const wanted = Math.min(MUSIC.hat.maxCents, listeners.length * perListener) * factor;
      cents = earn(sim, p, Math.round(wanted / 5) * 5);
      remember(sim, hatKey, cents, p);
    }
    let friends = 0;
    for (const id of listeners) {
      const key = villagerFactKey(id, MUSIC.memory.listened, p);
      if (recall(sim.world, key)?.day === day) continue;
      remember(sim, key, mine.rating, p);
      if (addBond(sim, p, id, Math.round(MUSIC.bond.points[mine.rating] * factor)) > 0)
        friends += 1;
    }
    results[p] = { rating: mine.rating, ...mine.tally, cents, friends };
  }
  const emote = MUSIC.audience.emotes[rating];
  if (emote !== null && place !== undefined)
    for (const id of listeners) {
      const life = place.villagers[id]?.life;
      if (life !== undefined) showEmote(sim, life, emote);
    }
  const before = bestRating(sim.world, playing.air);
  if (before === null || rating > before) remember(sim, bestKey(playing.air), rating, 'duo');
  sim.emit({
    type: 'music_finished',
    target: recital.target,
    air: playing.air,
    rating,
    duo,
    together,
    first: before === null,
    listeners: listeners.length,
    results,
  });
  const stage = stageOf(sim.world);
  stage.recitals = stage.recitals.filter((r) => r !== recital);
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type === 'music_assist') {
    const member = recitalWith(sim.world, player)?.members[player] ?? null;
    if (member !== null) member.assist = intent.level;
  } else if (intent.type === 'music_go') go(sim, player, intent);
  else if (intent.type === 'music_note') note(sim, player, intent);
  else if (intent.type === 'music_leave') leave(sim, player);
}

function step(sim: SimContext): void {
  const stage = stages.get(sim.world);
  if (stage === undefined || stage.recitals.length === 0) return;
  if (stage.place !== sim.world.common.place || sim.world.common.phase === 'travel') {
    stage.recitals = [];
    return;
  }
  for (const recital of [...stage.recitals]) {
    for (const p of [0, 1] as const) {
      if (recital.members[p] === null) continue;
      const body = sim.world.players[p].body;
      const far = Math.hypot(body.x - recital.x, body.y - recital.y) > MUSIC.reach * 1.5;
      // S'éloigner ou ranger l'instrument arrête de jouer, sans rien coûter.
      if (far || heldInstrument(sim.content, sim.world, p) === null) leave(sim, p);
    }
    if (!stage.recitals.includes(recital) || recital.playing === null) continue;
    gatherAudience(sim, recital);
    if (sim.world.tick >= recital.playing.endTick) finish(sim, recital);
  }
}

export const musicSystem: GameSystem = { id: 'musique', intent: onIntent, step };
