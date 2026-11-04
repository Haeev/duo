/**
 * Les sons du village agrandi (0.13, lot L4 bis), logique pure: les cloches de Saint-Aubin
 * (angélus, messe du dimanche), les boucles des métiers quand un habitant y travaille, les
 * ambiances placées (bief, lavoir, terrasse du café, ferme), la forêt profonde par la position,
 * le sifflet aux passages à niveau et le décodage à l'avance des sons de chaque lieu. Les
 * événements du lot de la vie du village sont dans `declencheurs.ts` (`villageEventSound`).
 */
import type { RandomSource } from '@duo/sdk/sim';
import { weekdayOf } from '../donnees/calendrier';
import { type GameMap, type Rect, mapMaxX } from '../etat/carte';
import type { ReadonlyWorld, Vec2 } from '../etat/types';
import { inHours } from './ambiances';
import type { Catalogue } from './catalogue';
import type { LoopWish, SoundRequest } from './declencheurs';
import { distanceBetween, distanceToRect } from './espace';
import { type AudioSettings, dbToGain, type VillagePlace } from './reglages';
import { type SequenceCatalogue, type SequenceShot, SequenceRun } from './sequences';

/** Un habitant compte comme attablé à moins de tant du point de l'ambiance (m). */
const SEATED_NEAR_M = 8;

const MINUTES_PER_HOUR = 60;
/** Un habitant est arrivé à son point à moins de tant (m). */
const AT_POINT_M = 2.5;

export interface VillageInput {
  world: ReadonlyWorld;
  listener: Vec2;
  gameTime: number;
  /** Temps de la séquence d'arrivée du train (s), `null` hors arrivée. */
  arrival: number | null;
}

interface Crossing {
  x: number;
  at: Vec2;
}

/** Profondeur dans le rectangle (m, positive dedans), ou moins la distance au bord dehors. */
function depthIn(r: Rect, at: Vec2): number {
  const inside = at.x >= r.x && at.x <= r.x + r.w && at.y >= r.y && at.y <= r.y + r.h;
  if (!inside) return -distanceToRect(at, r);
  return Math.min(at.x - r.x, r.x + r.w - at.x, at.y - r.y, r.y + r.h - at.y);
}

export class VillageSounds {
  private readonly bells: AudioSettings['village']['bells'];
  private readonly seqCatalogue: SequenceCatalogue;
  private readonly shotsBuffer: SequenceShot[] = [];
  private bellRun: { start: number; run: SequenceRun } | null = null;
  private lastMinutes = -1;
  private lastDay = -1;
  private readonly beatNext = new Map<string, number>();
  private readonly ambienceAt = new Map<string, Vec2[]>();
  private readonly crossings: Crossing[];
  private readonly crossingDone = new Set<number>();
  private readonly files = new Set<string>();
  private readonly loopKeys = new Map<string, string>();

  constructor(
    private readonly catalogue: Catalogue,
    private readonly settings: AudioSettings,
    private readonly map: GameMap,
    private readonly random: RandomSource,
  ) {
    this.bells = settings.village.bells;
    this.seqCatalogue = {
      duration: (id) => catalogue.sounds.get(id)?.durations[0] ?? 0,
      isBedMusic: () => false,
      isSynced: () => false,
      lateTolerance: settings.sequences.lateToleranceSeconds,
    };
    for (const rule of settings.village.placedAmbiences) this.ambienceAt.set(rule.key, this.ambiencePoints(rule));
    this.crossings = [];
    for (const id of settings.village.crossings.zones) {
      const r = map.zones[id];
      if (r !== undefined) this.crossings.push({ x: r.x + r.w / 2, at: { x: r.x + r.w / 2, y: r.y + r.h / 2 } });
    }
  }

  /** Fichiers à garder décodés (lieux proches, cloches bientôt). Réutilisé d'une image à l'autre. */
  wantedFiles(): ReadonlySet<string> {
    return this.files;
  }

  /** Une image: sons ponctuels (`shots`), boucles voulues (`loops`), niveau de la forêt (`ambience`). */
  update(input: VillageInput, shots: SoundRequest[], loops: LoopWish[], ambience: Map<string, number>, needed: Set<string>): void {
    this.files.clear();
    this.updateBells(input, shots);
    this.updateWork(input, shots, loops);
    this.updateAmbiences(input, loops);
    this.updateMillWheel(input, loops);
    this.updateForest(input, ambience, needed);
    this.updateCrossings(input, shots);
    this.updatePlaces(input.listener);
  }

  private want(sound: string): void {
    for (const file of this.catalogue.sounds.get(sound)?.files ?? []) this.files.add(file);
  }

  private pointOf(id: string): Vec2 | null {
    const p = this.map.points[id];
    return p === undefined ? null : { x: p.x, y: p.y };
  }

  private key(prefix: string, index: number): string {
    const id = `${prefix}:${index}`;
    let key = this.loopKeys.get(id);
    if (key === undefined) {
      key = `village:${id}`;
      this.loopKeys.set(id, key);
    }
    return key;
  }

  // ---------------------------------------------------------------------------
  // Cloches

  private updateBells(input: VillageInput, shots: SoundRequest[]): void {
    const { world, gameTime } = input;
    const b = this.bells;
    const day = world.clock.day;
    const minutes = world.clock.minutes;
    const sunday = weekdayOf(day) === b.mass.weekday;
    const rings: { at: number; sound: string | null }[] = b.angelusHours.map((h) => ({ at: h * MINUTES_PER_HOUR, sound: null }));
    if (sunday) {
      rings.push({ at: b.mass.callMinutes, sound: b.mass.callSound }, { at: b.mass.endMinutes, sound: b.mass.endSound });
    }
    const playing = world.phase === 'day' && this.lastDay === day && this.lastMinutes >= 0;
    for (const ring of rings) {
      if (minutes >= ring.at - b.decodeBeforeMinutes && minutes <= ring.at + b.decodeAfterMinutes) {
        if (ring.sound === null) {
          for (const step of this.catalogue.sequences.get(b.angelusSequence) ?? []) if (step.play !== null) this.want(step.play);
        } else {
          this.want(ring.sound);
        }
      }
      if (!playing || this.lastMinutes >= ring.at || minutes < ring.at) continue;
      if (ring.sound === null) {
        const steps = this.catalogue.sequences.get(b.angelusSequence);
        if (steps !== undefined) this.bellRun = { start: gameTime, run: new SequenceRun(b.angelusSequence, steps, this.seqCatalogue) };
      } else {
        shots.push({ sound: ring.sound, at: { x: b.at.x, y: b.at.y }, gainDb: 0, delay: 0, offset: 0, tag: null });
      }
    }
    this.lastMinutes = minutes;
    this.lastDay = day;
    if (this.bellRun !== null) {
      const out = this.shotsBuffer;
      out.length = 0;
      this.bellRun.run.advance(gameTime - this.bellRun.start, out);
      for (const shot of out) shots.push({ sound: shot.sound, at: { x: b.at.x, y: b.at.y }, gainDb: 0, delay: 0, offset: 0, tag: null });
      if (this.bellRun.run.done()) this.bellRun = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Métiers

  /** Le premier habitant visible arrivé à l'un de ces points pour l'une de ces activités. */
  private worker(world: ReadonlyWorld, points: readonly string[], activities: readonly string[]): Vec2 | null {
    for (const v of world.villagers) {
      if (!v.visible || !points.includes(v.target) || !activities.includes(v.activity)) continue;
      const p = this.map.points[v.target];
      if (p !== undefined && Math.hypot(v.pos.x - p.x, v.pos.y - p.y) > AT_POINT_M) continue;
      return { x: v.pos.x, y: v.pos.y };
    }
    return null;
  }

  private reachOf(sound: string, fallback: number): number {
    return this.catalogue.sounds.get(sound)?.spatial?.cullBeyond ?? fallback;
  }

  private updateWork(input: VillageInput, shots: SoundRequest[], loops: LoopWish[]): void {
    const { world, listener, gameTime } = input;
    const v = this.settings.village;
    v.workLoops.forEach((rule, index) => {
      const at = this.worker(world, rule.points, rule.activities);
      if (at === null || distanceBetween(listener, at) > this.reachOf(rule.sound, 45)) return;
      loops.push({ key: this.key(rule.key, index), sound: rule.sound, at, gainDb: 0 });
    });
    for (const rule of v.workBeats) {
      const at = this.worker(world, rule.points, rule.activities);
      if (at === null) {
        this.beatNext.delete(rule.key);
        continue;
      }
      const next = this.beatNext.get(rule.key);
      if (next !== undefined && gameTime < next) continue;
      const [low, high] = rule.intervalSeconds;
      this.beatNext.set(rule.key, gameTime + (high > low ? this.random.float(low, high) : low));
      if (next !== undefined && distanceBetween(listener, at) <= this.reachOf(rule.sound, 45)) {
        shots.push({ sound: rule.sound, at, gainDb: 0, delay: 0, offset: 0, tag: null });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Ambiances placées et forêt

  private ambiencePoints(rule: AudioSettings['village']['placedAmbiences'][number]): Vec2[] {
    const out: Vec2[] = [];
    for (const id of rule.points ?? []) {
      const p = this.pointOf(id);
      if (p !== null) out.push(p);
    }
    const along = rule.alongZone;
    const r = along === undefined ? undefined : this.map.zones[along.zone];
    if (along !== undefined && r !== undefined) {
      const count = Math.max(1, along.count);
      for (let k = 0; k < count; k += 1) out.push({ x: r.x + (r.w * (k + 0.5)) / count, y: r.y + r.h / 2 });
    }
    return out;
  }

  private updateAmbiences(input: VillageInput, loops: LoopWish[]): void {
    const { world, listener } = input;
    const hour = world.clock.minutes / MINUTES_PER_HOUR;
    for (const rule of this.settings.village.placedAmbiences) {
      if (world.phase !== 'day') continue;
      if (rule.hours !== null && !inHours(hour, rule.hours[0], rule.hours[1])) continue;
      if (rule.whenVillagerAt !== null) {
        // Le murmure n'a de sens que si l'on voit des habitants attablés: arrivés près du lieu,
        // à une place (`seat:<point>:...`) ou au point lui-même (demande du client, 2026-11-04).
        const points = rule.whenVillagerAt;
        const anchors = this.ambienceAt.get(rule.key) ?? [];
        const seated = world.villagers.some((v) => {
          if (!v.visible) return false;
          const target = v.target.startsWith('seat:') ? (v.target.split(':')[1] ?? '') : v.target;
          if (!points.includes(target)) return false;
          return anchors.some((at) => distanceBetween(v.pos, at) <= SEATED_NEAR_M);
        });
        if (!seated) continue;
      }
      const points = this.ambienceAt.get(rule.key) ?? [];
      points.forEach((at, index) => {
        if (distanceBetween(listener, at) > rule.reachM) return;
        loops.push({ key: this.key(rule.key, index), sound: rule.sound, at, gainDb: 0 });
      });
    }
  }

  private updateMillWheel(input: VillageInput, loops: LoopWish[]): void {
    const { world, listener } = input;
    const m = this.settings.village.millWheel;
    const running = world.flags.includes(m.flag) || world.worldStates[m.worldState.key] === m.worldState.value;
    if (!running || world.phase !== 'day') return;
    if (m.notWeekdays.includes(weekdayOf(world.clock.day))) return;
    if (!inHours(world.clock.minutes / MINUTES_PER_HOUR, m.hours[0], m.hours[1])) return;
    if (distanceBetween(listener, m.at) > m.reachM) return;
    loops.push({ key: this.key('mill-wheel', 0), sound: m.sound, at: { x: m.at.x, y: m.at.y }, gainDb: 0 });
  }

  private updateForest(input: VillageInput, ambience: Map<string, number>, needed: Set<string>): void {
    const f = this.settings.village.forest;
    if (!this.catalogue.sounds.has(f.sound)) return;
    let depth = Number.NEGATIVE_INFINITY;
    for (const id of f.zones) {
      const r = this.map.zones[id];
      if (r !== undefined) depth = Math.max(depth, depthIn(r, input.listener));
    }
    const hour = input.world.clock.minutes / MINUTES_PER_HOUR;
    const open = input.world.phase === 'day' && inHours(hour, f.hours[0], f.hours[1]);
    const level = open ? Math.min(1, Math.max(0, depth / Math.max(0.1, f.fadeInM))) : 0;
    ambience.set(f.sound, Math.max(ambience.get(f.sound) ?? 0, level));
    if (open && depth > -f.decodeMarginM) needed.add(f.sound);
    if (level <= 0) return;
    for (const [id, db] of Object.entries(f.lowerDb)) {
      const gain = ambience.get(id);
      if (gain !== undefined && gain > 0) ambience.set(id, gain * dbToGain(db * level));
    }
  }

  // ---------------------------------------------------------------------------
  // Passages à niveau

  /**
   * Le train arrive par l'est (`departureDirection` -1) depuis le bord de la carte, comme le rendu
   * (`trainSlides` de `rendu/voie.ts`): la locomotive siffle à `leadM` avant chaque passage sans
   * barrière qu'elle n'a pas encore franchi, jamais pendant le sifflet d'annonce.
   */
  private updateCrossings(input: VillageInput, shots: SoundRequest[]): void {
    const c = this.settings.village.crossings;
    const t = input.arrival;
    const train = input.world.train;
    if (t === null) this.crossingDone.clear();
    if (t === null || !Number.isFinite(t) || train.phase !== 'arriving' || t < c.notBeforeSeconds) return;
    const stop = this.map.points[this.settings.train.stopPoint];
    if (stop === undefined) return;
    const stopX = stop.x + this.settings.train.locomotiveOffsetM;
    const slide = Math.max(this.settings.train.slideDistanceM, mapMaxX(this.map) + 1 + c.offMapClearanceM - stopX);
    const p = Math.min(1, Math.max(0, train.progress));
    const x = stopX + slide * (1 - p) * (1 - p) * (1 - p) * -this.settings.train.departureDirection;
    this.crossings.forEach((crossing, index) => {
      if (this.crossingDone.has(index)) return;
      const ahead = (x - crossing.x) * -this.settings.train.departureDirection;
      if (ahead > c.leadM) return;
      this.crossingDone.add(index);
      // Déjà passé (au début de l'arrivée, couvert par le sifflet d'annonce): rien.
      if (ahead < 0) return;
      shots.push({ sound: c.sound, at: { x: crossing.at.x, y: crossing.at.y }, gainDb: 0, delay: 0, offset: 0, tag: null });
    });
  }

  // ---------------------------------------------------------------------------
  // Décodage à l'avance

  private distanceTo(place: VillagePlace, at: Vec2): number {
    if (place.point !== undefined) {
      const p = this.map.points[place.point];
      return p === undefined ? Number.POSITIVE_INFINITY : distanceBetween(at, p);
    }
    if (place.zone !== undefined) {
      const r = this.map.zones[place.zone];
      return r === undefined ? Number.POSITIVE_INFINITY : distanceToRect(at, r);
    }
    return Number.POSITIVE_INFINITY;
  }

  private updatePlaces(at: Vec2): void {
    for (const place of this.settings.village.places) {
      if (this.distanceTo(place, at) > place.reachM) continue;
      for (const sound of place.sounds) this.want(sound);
    }
  }
}
