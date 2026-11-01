/**
 * Les sons des moments rares (conception du tour 6, section 1.4; `sons.json`, champs `moment` et
 * `momentSound`), logique pure lue par le cerveau à chaque image:
 * - les fichiers du moment du jour à décoder dès qu'il s'installe (le dossier `moments/` n'est
 *   pas permanent: 13 Mo décodés pour tout le dossier);
 * - les sons d'attente (`sounds.idle`): boucles placées (les oies posées, les grillons, à -6 dB
 *   pendant l'attente puis à pleine force pendant l'apogée) et sons espacés (pas du héron);
 * - les sons datés de l'apogée et du départ, joués quand le temps de la chorégraphie
 *   (`today.elapsed`, figé pendant une pause de l'échelle) passe leur instant, placés à leur bête;
 * - la volée des oies, qui suit l'oie de tête (son recalé sur la chorégraphie);
 * - la musique plus basse pendant l'apogée (`moments.musicDuckDb`).
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { Content, MomentChoreography, MomentDef } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import { actorPose, idleGestureAt, startleTicks } from '../etat/moments';
import { SIM_HZ } from '../etat/types';
import type { DeepReadonly, MomentToday, ReadonlyWorld, Vec2 } from '../etat/types';
import type { Catalogue, SoundDef } from './catalogue';
import type { SyncState } from './cerveau';
import type { LoopWish, SoundRequest } from './declencheurs';
import type { AudioSettings } from './reglages';

const POINT_PREFIX = '@';

/** Un son suivi (la volée): son étiquette, son instant de départ dans la chorégraphie. */
interface Followed {
  tag: string;
  sound: string;
  name: string;
  from: number;
  duration: number;
  choreography: 'climax' | 'left';
}

export class MomentSounds {
  private readonly needed = new Set<string>();
  private readonly idleNext = new Map<string, number>();
  private readonly followed: Followed[] = [];
  private choreoKey = '';
  private firedUntil = Number.NEGATIVE_INFINITY;
  private duck = 0;
  /** Effarouchement ou timidité en cours (tick de début, sons pas encore joués), pour ses sons datés. */
  private reaction: { start: number; pending: [number, string][] } | null = null;
  private reactionActive = false;
  /** Geste d'attente en cours par acteur (début en s depuis l'attente) et ses sons déjà joués. */
  private readonly gestures = new Map<string, { start: number; fired: number }>();

  constructor(
    private readonly catalogue: Catalogue,
    private readonly settings: AudioSettings,
    private readonly content: Content,
    private readonly map: GameMap,
    private readonly random: RandomSource,
  ) {}

  /** Fichiers du moment du jour à garder décodés (vide sans moment). */
  files(): ReadonlySet<string> {
    return this.needed;
  }

  /** Atténuation voulue de la musique (dB): `musicDuckDb` pendant l'apogée, 0 sinon. */
  duckDb(): number {
    return this.duck;
  }

  /** Sons du catalogue pour un nom de la fiche (`heron_wings` ou `heron-wings`). */
  private sound(name: string): SoundDef | undefined {
    return this.catalogue.sounds.get(name) ?? this.catalogue.sounds.get(name.replaceAll('_', '-'));
  }

  update(world: ReadonlyWorld, gameTime: number, shots: SoundRequest[], loops: LoopWish[], syncs: SyncState[]): void {
    const today = world.moments.today;
    const def = today === null ? undefined : this.content.moments.find((m) => m.id === today.id);
    this.needed.clear();
    this.duck = 0;
    // Hors de la journée (écran de nuit, fin), la simulation n'avance plus les moments: leurs sons
    // se taisent comme l'ambiance, même si le moment est encore « là » jusqu'à 23 h 30 (QA6-05).
    if (today === null || def === undefined || today.phase === 'gone' || world.phase !== 'day') {
      this.stopFollowed(syncs);
      return;
    }
    // Le moment s'installe (même avant sa présence): ses sons se décodent, avant l'apogée.
    for (const s of this.catalogue.sounds.values()) {
      if (s.moment?.id === def.id) for (const file of s.files) this.needed.add(file);
    }
    this.idle(world, def, today, gameTime, shots, loops);
    this.reactions(world, def, today, shots);
    const choreography = today.phase === 'climax' ? def.climax : today.phase === 'left' ? def.leave : null;
    if (today.phase === 'climax') this.duck = this.content.settings.moments.musicDuckDb;
    if (choreography === null) {
      this.stopFollowed(syncs);
      return;
    }
    const key = `${def.id}|${String(today.day)}|${today.phase}|${String(today.phaseTick)}`;
    if (key !== this.choreoKey) {
      this.choreoKey = key;
      this.firedUntil = Number.NEGATIVE_INFINITY;
      this.stopFollowed(syncs);
    }
    this.fire(world, def, today, choreography, shots);
    this.follow(def, today, syncs);
  }

  /** Sons datés passés depuis l'image d'avant. */
  private fire(world: ReadonlyWorld, def: MomentDef, today: DeepReadonly<MomentToday>, choreo: MomentChoreography, shots: SoundRequest[]): void {
    const t = today.elapsed;
    for (const [at, name] of choreo.sounds) {
      if (at <= this.firedUntil || at > t) continue;
      if (this.settings.moments.hensOnly.includes(name) && world.hens.length === 0) continue;
      const s = this.sound(name);
      if (s === undefined) continue;
      if (this.settings.moments.followed.includes(name)) {
        this.followed.push({
          tag: `moment:${def.id}:${s.id}`,
          sound: s.id,
          name,
          from: at,
          duration: Math.max(...s.durations, 0),
          choreography: today.phase === 'left' ? 'left' : 'climax',
        });
        continue;
      }
      // Un son en retard (invité, image lente) part quand même, au plus une seconde après.
      if (t - at > 1) continue;
      shots.push({ sound: s.id, at: this.source(def, today, name), gainDb: 0, delay: 0, offset: 0, tag: null });
    }
    this.firedUntil = Math.max(this.firedUntil, t);
  }

  /** La volée suit l'oie de tête: position et instant recalés à chaque image. */
  private follow(def: MomentDef, today: DeepReadonly<MomentToday>, syncs: SyncState[]): void {
    for (let i = this.followed.length - 1; i >= 0; i -= 1) {
      const f = this.followed[i];
      if (f === undefined) continue;
      const expected = today.elapsed - f.from;
      const over = expected >= f.duration;
      syncs.push({ tag: f.tag, sound: f.sound, expected: over ? null : Math.max(0, expected), at: this.source(def, today, f.name) });
      if (over) this.followed.splice(i, 1);
    }
  }

  private stopFollowed(syncs: SyncState[]): void {
    for (const f of this.followed) syncs.push({ tag: f.tag, sound: f.sound, expected: null, at: null });
    this.followed.length = 0;
  }

  /** Sons d'attente: boucles placées (et leur niveau selon la phase), sons espacés. */
  private idle(world: ReadonlyWorld, def: MomentDef, today: DeepReadonly<MomentToday>, gameTime: number, shots: SoundRequest[], loops: LoopWish[]): void {
    for (const entry of def.sounds.idle) {
      const s = this.sound(entry.id);
      if (s === undefined) continue;
      const key = `moment:${def.id}:${s.id}`;
      if (s.loop !== null) {
        const ramp = s.moment?.climaxRampSeconds ?? 0;
        const waitingDb = s.moment?.waitingDb ?? 0;
        // Une boucle qui monte à l'apogée (les grillons) reste jusqu'au départ; les autres s'arrêtent à l'envol.
        let gainDb: number | null = null;
        if (today.phase === 'waiting') gainDb = waitingDb;
        else if (ramp > 0 && today.phase === 'climax') gainDb = waitingDb * Math.max(0, 1 - today.elapsed / ramp);
        else if (ramp > 0 && today.phase === 'after') gainDb = 0;
        if (gainDb !== null) loops.push({ key, sound: s.id, at: this.source(def, today, entry.id), gainDb });
        continue;
      }
      if (today.phase !== 'waiting') {
        this.idleNext.delete(key);
        continue;
      }
      const next = this.idleNext.get(key);
      if (next === undefined) {
        this.idleNext.set(key, gameTime + this.draw(entry.everySeconds));
        continue;
      }
      if (gameTime < next) continue;
      this.idleNext.set(key, gameTime + this.draw(entry.everySeconds));
      const at = this.source(def, today, entry.id);
      // Au-delà de la distance d'audition de la fiche, rien (le moteur coupe aussi au loin).
      const near = at === null || world.characters.some((c) => Math.hypot(c.pos.x - at.x, c.pos.y - at.y) <= entry.range);
      if (near) shots.push({ sound: s.id, at, gainDb: 0, delay: 0, offset: 0, tag: null });
    }
  }

  /**
   * Sons datés de l'attente (tour 7): l'effarouchement de la chevrette (coup de sabot, aboiement),
   * la fuite du martin-pêcheur (sifflet), et ses plongeons manqués, aux instants que le rendu
   * dessine (`freezeState`, `idleGestureAt`, tirés de l'état: mêmes chez l'hôte et l'invité).
   */
  private reactions(world: ReadonlyWorld, def: MomentDef, today: DeepReadonly<MomentToday>, shots: SoundRequest[]): void {
    if (today.phase !== 'waiting') {
      this.reaction = null;
      this.reactionActive = false;
      this.gestures.clear();
      return;
    }
    const tick = world.tick;
    const active = today.shyUntil > tick;
    const freeze = def.watch.freeze;
    if (active && !this.reactionActive) {
      const shy = def.actors.find((a) => a.shy !== null)?.shy ?? null;
      const start = freeze !== null ? today.shyUntil - startleTicks(freeze) : tick;
      const sounds = freeze !== null ? freeze.sounds : (shy?.sounds ?? []);
      this.reaction = { start, pending: [...sounds] };
    }
    this.reactionActive = active;
    const r = this.reaction;
    if (r !== null) {
      for (let i = r.pending.length - 1; i >= 0; i -= 1) {
        const entry = r.pending[i];
        if (entry === undefined) continue;
        const at = r.start + Math.round(entry[0] * SIM_HZ);
        if (tick < at) continue;
        r.pending.splice(i, 1);
        if (tick - at > SIM_HZ) continue;
        this.shot(def, today, entry[1], shots);
      }
    }
    const t = (tick - today.phaseTick) / SIM_HZ;
    for (const actor of def.actors) {
      const extra = actor.idleExtra;
      if ((extra?.segment ?? null) === null || extra === null || extra.sounds.length === 0) continue;
      // Pas de plongeon pendant qu'il est parti (timidité): le rendu ne le dessine pas non plus.
      const since = active ? null : idleGestureAt(def, actor, world.seed, today.day, t);
      if (since === null) continue;
      const start = t - since;
      let g = this.gestures.get(actor.id);
      if (g === undefined || Math.abs(g.start - start) > 0.25) {
        g = { start, fired: 0 };
        this.gestures.set(actor.id, g);
      }
      while (g.fired < extra.sounds.length) {
        const entry = extra.sounds[g.fired];
        if (entry === undefined || since < entry[0]) break;
        g.fired += 1;
        if (since - entry[0] <= 1) this.shot(def, today, entry[1], shots);
      }
    }
  }

  private shot(def: MomentDef, today: DeepReadonly<MomentToday>, name: string, shots: SoundRequest[]): void {
    const s = this.sound(name);
    if (s === undefined) return;
    shots.push({ sound: s.id, at: this.source(def, today, name), gainDb: 0, delay: 0, offset: 0, tag: null });
  }

  /** D'où part un son: l'acteur ou le point des réglages, sinon la bête du moment, sinon son point. */
  private source(def: MomentDef, today: DeepReadonly<MomentToday>, name: string): Vec2 | null {
    const s = this.sound(name);
    if (s?.spatial === null) return null;
    const wanted = this.settings.moments.sources[name];
    if (wanted?.startsWith(POINT_PREFIX) === true) {
      const p = this.map.points[wanted.slice(POINT_PREFIX.length)];
      if (p !== undefined) return { x: p.x, y: p.y };
    }
    const actor = wanted ?? def.actors.find((a) => a.villager === null && Object.keys(def.climax.keyframes).includes(a.id))?.id;
    const pose = actor === undefined ? null : actorPose(this.map, def, today, actor);
    if (pose !== null) return { x: pose.x, y: pose.y };
    const anchor = this.map.points[def.anchor];
    return anchor === undefined ? null : { x: anchor.x, y: anchor.y };
  }

  private draw(range: readonly [number, number]): number {
    const [low, high] = range;
    return high > low ? this.random.float(low, high) : low;
  }
}
