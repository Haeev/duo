/**
 * La vie du village (0.13, lot H7; section 7 de `v0-13-habitants.md`, README des données 2.13):
 * scènes entre habitants, pauses, places assises, postes de métier et chat du bourg, lus dans
 * `vie.json`. Les gestes des habitants avec le décor et leurs réactions sont dans `gestes-0-13.json`
 * (`gestes-0-13.ts`).
 */
import { ContentError, type Reader } from './lecteur';
import { WORK_STROKE_EVENTS, type WorkStrokeEvent } from '../etat/types';
import { SEASONS } from './calendrier';
import type { Condition, Season } from './types';

/** Lit une liste de conditions (`when`), avec la règle de `contenu.ts`. */
export type ConditionsReader = (r: Reader | null) => Condition[];

/** Un point du plan de la carte (m). */
export interface PlanPoint {
  x: number;
  y: number;
}

/** Une place d'une scène: debout autour d'un centre, ou assise (`seat`), ou au point du planning. */
export type SceneGroupPlace =
  /** En cercle de `radius` autour de `at`, chacun tourné vers le centre. */
  | { kind: 'circle'; at: PlanPoint; radius: number }
  /** Une place par membre, dans l'ordre de `who` (cap en radians, convention des personnages), assise ou debout. */
  | { kind: 'spots'; seated: boolean; spots: { x: number; y: number; facing: number }[] }
  /** Chacun reste au point de son planning et se tourne vers les autres membres. */
  | { kind: 'planning' }
  /**
   * Portage à deux (S09): les deux membres, face à face à `apart` m, vont et viennent entre `from`
   * (aller à vide) et `to` (retour chargé, la charge `load` entre leurs mains), une étape toutes
   * les `legMinutes` minutes de jeu.
   */
  | { kind: 'shuttle'; from: PlanPoint; to: PlanPoint; legMinutes: number; apart: number; load: string };

export interface SceneGroupDef {
  who: string[];
  place: SceneGroupPlace;
  /** Activité jouée pendant la scène (`chat` par défaut; vide au point du planning: la sienne). */
  activity: string;
}

/** Une bulle de la réserve d'une scène: qui la dit, le texte. */
export interface SceneLineDef {
  by: string;
  text: string;
}

/**
 * Scène d'une histoire sur plusieurs jours (S06, la soupe): elle tient le `day`-ième jour (1, 2,
 * 3...) à partir du premier jour de pluie de `season` parmi ses `rainBy` premiers jours, ou du
 * dernier de ces jours s'il n'a pas plu.
 */
export interface SceneArc {
  season: Season;
  rainBy: number;
  day: number;
}

export interface SceneDef {
  id: string;
  /** Numéro de la table 7.2 (`S11`), pour la relecture. */
  ref: string;
  tier: 'P0' | 'P1';
  /** Plage de la scène (minutes depuis minuit, `[from, to[`). */
  from: number;
  to: number;
  /** Conditions du jour (mêmes règles que les plannings). */
  when: Condition[];
  /**
   * Un membre ne vient que si son planning, à la minute `at` (par défaut celle d'avant `from`), le
   * mettait à l'un de ces points (sortie de la messe: ceux qui étaient dans la nef); `null`: s'il est
   * dans le bourg (ni chez lui ni hors de la carte) à cet instant.
   */
  cameFrom: { points: string[]; at: number } | null;
  /**
   * Sans `cameFrom`: un membre chez lui en sort pour venir (anniversaire, la soupe); faux: seulement
   * s'il est déjà dans le bourg. Jamais depuis le hors-carte.
   */
  everyone: boolean;
  /** Jour d'une histoire en plusieurs jours, `null`: chaque jour où `when` tient. */
  arc: SceneArc | null;
  groups: SceneGroupDef[];
  lines: SceneLineDef[];
}

/** Poste de métier: là où un habitant fait son geste, devant l'outil (enclume, établi). */
export interface WorkPostDef {
  /** Point du planning et activité qui mènent au poste; `who`: ses habitants (vide: tous). */
  point: string;
  activity: string;
  who: string[];
  /** Où il se tient (centre du corps), `null`: au point; où il regarde (cap en radians), `null`: comme le point. */
  at: PlanPoint | null;
  facing: number | null;
  /** Clip du geste (`personnages.glb`), outil en main (modèle de `ferme.glb`) ou `null`. */
  clip: string;
  tool: string | null;
  /** Événement de chaque coup (son du lot H8), `null`: aucun. */
  event: WorkStrokeEvent | null;
  /** Un coup toutes les `strokeSeconds` (durée du clip), entendu à moins de `hearRange`. */
  strokeSeconds: number;
  hearRange: number;
}

/**
 * Places assises d'un point de planning (tables du café): un habitant qui y vient pour l'une de ces
 * activités prend la première place libre et s'y assoit.
 */
export interface SeatingDef {
  point: string;
  activities: string[];
  seats: { x: number; y: number; facing: number }[];
}

export type CatPoseDef = 'idle' | 'sleep';

/** Une habitude du chat (section 7.4): les places où il se pose, la pose qu'il y prend. */
export interface CatHabitDef {
  id: string;
  from: number;
  to: number;
  when: Condition[];
  spots: PlanPoint[];
  pose: CatPoseDef;
  /** Où il regarde, posé (cap en radians), `null`: dans le sens de sa marche. */
  facing: number | null;
}

/** Une pause de tous les habitants dehors (l'angélus, S10): ils s'arrêtent et lèvent la tête. */
export interface VillagePauseDef {
  id: string;
  ref: string;
  /** Débuts (minutes depuis minuit) et durée (minutes de jeu). */
  at: number[];
  minutes: number;
  /** Clip joué à l'arrêt (`look_up`). */
  clip: string;
}

export interface CatDef {
  /** Le chat est au bourg (conditions de son arrivée); faux: aucun chat. */
  when: Condition[];
  habits: CatHabitDef[];
  /** Vitesse de marche, de fuite (m/s). */
  walkSpeed: number;
  fleeSpeed: number;
  /** Temps passé à une place avant d'aller à une autre de la même habitude (minutes de jeu). */
  stayMinutes: [number, number];
  /** Chance de se rouler par terre en arrivant à une place (0 à 1), et durée de la roulade (s). */
  rollChance: number;
  rollSeconds: number;
  flee: {
    /** Un joueur à moins de `range` m qui va plus vite que `speedAbove` (vitesse lissée) le fait fuir. */
    range: number;
    speedAbove: number;
    /** Lissage de la vitesse du joueur (s): de petits pas (touche tapotée) restent lents. */
    smoothingSeconds: number;
    /** Distance parcourue en fuyant (m). */
    distance: number;
  };
  /** Un joueur qui approche doucement à moins de `range` m: il se tourne vers lui (couché: il reste couché). */
  watchRange: number;
  /** Il suit parfois (`chance` par approche douce) un joueur `seconds` secondes, à `distance` m derrière lui. */
  follow: { chance: number; seconds: number; distance: number };
  /** Décision à deux qui lui donne son nom (`decisions.json`), `null`: il n'a pas de nom. */
  nameDecision: string | null;
  /** Où il sort du panier de Margot le jour de son arrivée (m), `null`: directement à sa place. */
  arrival: PlanPoint | null;
  /**
   * Sa trouvaille de la semaine (section 7.4): un jour de chaque semaine tiré par la graine, à
   * l'aube, il dépose l'un de ces objets devant `point` (décalé de `offset` m). `null`: aucune.
   */
  gift: { point: string; offset: PlanPoint; items: string[] } | null;
  /**
   * Le caresser (geste 30 de la table 7.1): Agir à moins de `range` m quand il est posé (assis ou
   * couché); `heart` de Cœur une fois par jour; caressé par les deux à moins de `togetherSeconds`
   * d'écart, il se roule sur le dos. `label`: l'invite (`{name}`: son nom, ou « le chat »).
   */
  pet: { range: number; seconds: number; heart: number; togetherSeconds: number; label: string } | null;
}

/**
 * Saluts quand deux habitants se croisent (S01): de `from` à `to`, deux habitants dehors à moins de
 * `range` m l'un de l'autre, dont l'un au moins marche, se saluent si la paire est tirée ce jour-là
 * (`chance`), une fois par paire et par jour. `{name}`: le prénom de l'autre.
 */
export interface GreetingsDef {
  ref: string;
  from: number;
  to: number;
  range: number;
  chance: number;
  lines: string[];
  replies: string[];
}

export interface VillageScenes {
  scenes: SceneDef[];
  workPosts: WorkPostDef[];
  seating: SeatingDef[];
  pauses: VillagePauseDef[];
  cat: CatDef | null;
  greetings: GreetingsDef | null;
  /** Bulles des scènes: une toutes les `bubbleSeconds` (s), lue à moins de `bubbleRange` m. */
  bubbleSeconds: number;
  bubbleRange: number;
}

export const EMPTY_VILLAGE_SCENES: VillageScenes = {
  scenes: [],
  workPosts: [],
  seating: [],
  pauses: [],
  cat: null,
  greetings: null,
  bubbleSeconds: 7,
  bubbleRange: 8,
};

const ID = /^[a-z][a-z0-9_]*$/;

function id(r: Reader): string {
  const value = r.string();
  if (!ID.test(value)) r.fail(`identifiant « snake_case » attendu, reçu « ${value} »`);
  return value;
}

function point(r: Reader): PlanPoint {
  return { x: r.at('x').number(), y: r.at('y').number() };
}

/** Cap de boussole en degrés (0 nord, 90 est) vers la convention des personnages (0 est, y au sud). */
export function compassToFacing(degrees: number): number {
  return ((degrees - 90) * Math.PI) / 180;
}

function parseGroup(g: Reader): SceneGroupDef {
  const who = g.at('who').items().map(id);
  if (who.length === 0) g.fail('au moins un habitant attendu');
  const at = g.opt('at');
  const spots = g.opt('spots');
  const shuttle = g.opt('shuttle');
  let place: SceneGroupPlace;
  if (shuttle !== null) {
    if (who.length !== 2) g.fail('un portage à deux attend deux habitants');
    place = {
      kind: 'shuttle',
      from: point(shuttle.at('from')),
      to: point(shuttle.at('to')),
      legMinutes: shuttle.at('legMinutes').number(),
      apart: shuttle.opt('apart')?.number() ?? 1.3,
      load: id(shuttle.at('load')),
    };
    if (place.legMinutes <= 0) shuttle.fail('« legMinutes » positif attendu');
  } else if (spots !== null) {
    const list = seatList(spots);
    if (list.length < who.length) spots.fail('une place par habitant attendue');
    place = { kind: 'spots', seated: g.opt('seated')?.boolean() ?? false, spots: list };
  } else if (at === null || (!at.isObject() && at.string() === 'planning')) {
    place = { kind: 'planning' };
  } else {
    place = { kind: 'circle', at: point(at), radius: g.opt('radius')?.number() ?? 0.7 };
  }
  const activity = g.opt('activity');
  // Au point du planning, il garde son activité (et le geste qui va avec) sauf si la scène en donne une.
  return { who, place, activity: activity === null ? (place.kind === 'planning' ? '' : 'chat') : id(activity) };
}

function parseScenes(r: Reader | null, conditions: ConditionsReader): SceneDef[] {
  if (r === null) return [];
  const seen = new Set<string>();
  return r.items().map((s): SceneDef => {
    const sceneId = id(s.at('id'));
    if (seen.has(sceneId)) s.fail(`scène en double « ${sceneId} »`);
    seen.add(sceneId);
    const from = s.at('from').time();
    const to = s.at('to').time();
    if (to <= from) s.fail('« to » après « from » attendu');
    const groups = s.at('groups').items().map(parseGroup);
    const members = groups.flatMap((g) => g.who);
    if (new Set(members).size !== members.length) s.fail('un habitant dans deux groupes');
    const came = s.opt('cameFrom');
    const lines = s.opt('lines');
    const arc = s.opt('arc');
    return {
      id: sceneId,
      ref: s.opt('ref')?.string() ?? '',
      tier: s.opt('tier')?.oneOf(['P0', 'P1'] as const) ?? 'P0',
      from,
      to,
      when: conditions(s.opt('when')),
      cameFrom:
        came === null
          ? null
          : { points: came.at('points').items().map(id), at: came.opt('at')?.time() ?? from - 1 },
      everyone: s.opt('everyone')?.boolean() ?? false,
      arc:
        arc === null
          ? null
          : {
              season: arc.at('season').oneOf(SEASONS),
              rainBy: arc.at('rainBy').integer(1, 30),
              day: arc.at('day').integer(1, 30),
            },
      groups,
      lines:
        lines === null
          ? []
          : lines.items().map((l) => ({ by: id(l.at('by')), text: l.at('text').string() })),
    };
  });
}

function parseWorkPosts(r: Reader | null): WorkPostDef[] {
  if (r === null) return [];
  return r.items().map((p) => {
    const at = p.opt('at');
    const cap = p.opt('cap');
    const tool = p.opt('tool');
    const event = p.opt('event');
    return {
      point: id(p.at('point')),
      activity: id(p.at('activity')),
      who: p.opt('who')?.items().map(id) ?? [],
      at: at === null ? null : point(at),
      facing: cap === null ? null : compassToFacing(cap.number()),
      clip: id(p.at('clip')),
      tool: tool === null ? null : id(tool),
      event: event === null ? null : event.oneOf(WORK_STROKE_EVENTS),
      strokeSeconds: p.opt('strokeSeconds')?.number() ?? 1,
      hearRange: p.opt('hearRange')?.number() ?? 0,
    };
  });
}

function seatList(r: Reader): { x: number; y: number; facing: number }[] {
  return r.items().map((s) => ({ ...point(s), facing: compassToFacing(s.at('cap').number()) }));
}

function parseSeating(r: Reader | null): SeatingDef[] {
  if (r === null) return [];
  return r.items().map((s) => ({
    point: id(s.at('point')),
    activities: s.at('activities').items().map(id),
    seats: seatList(s.at('seats')),
  }));
}

function parseCat(r: Reader | null, conditions: ConditionsReader): CatDef | null {
  if (r === null) return null;
  const stay = r.at('stayMinutes').numberList();
  if (stay.length !== 2 || (stay[0] ?? 0) > (stay[1] ?? 0)) r.at('stayMinutes').fail('[min, max] attendu');
  const flee = r.at('flee');
  const gift = r.opt('gift');
  const nameDecision = r.opt('nameDecision');
  const pet = r.opt('pet');
  return {
    when: conditions(r.opt('when')),
    habits: r
      .at('habits')
      .items()
      .map((h) => {
        const spots = h.at('spots').items().map(point);
        if (spots.length === 0) h.fail('au moins une place attendue');
        const cap = h.opt('cap');
        return {
          id: id(h.at('id')),
          from: h.at('from').time(),
          to: h.at('to').time(),
          when: conditions(h.opt('when')),
          spots,
          pose: h.at('pose').oneOf(['idle', 'sleep'] as const),
          facing: cap === null ? null : compassToFacing(cap.number()),
        };
      }),
    walkSpeed: r.at('walkSpeed').number(),
    fleeSpeed: r.at('fleeSpeed').number(),
    stayMinutes: [stay[0] ?? 0, stay[1] ?? 0],
    rollChance: r.at('rollChance').number(),
    rollSeconds: r.at('rollSeconds').number(),
    flee: {
      range: flee.at('range').number(),
      speedAbove: flee.at('speedAbove').number(),
      smoothingSeconds: flee.at('smoothingSeconds').number(),
      distance: flee.at('distance').number(),
    },
    watchRange: r.at('watchRange').number(),
    follow: {
      chance: r.at('follow').at('chance').number(),
      seconds: r.at('follow').at('seconds').number(),
      distance: r.at('follow').at('distance').number(),
    },
    nameDecision: nameDecision === null ? null : id(nameDecision),
    arrival: r.opt('arrival') === null ? null : point(r.at('arrival')),
    gift:
      gift === null
        ? null
        : {
            point: id(gift.at('point')),
            offset: gift.opt('offset') === null ? { x: 0, y: 0 } : point(gift.at('offset')),
            items: gift.at('items').items().map(id),
          },
    pet:
      pet === null
        ? null
        : {
            range: pet.at('range').number(),
            seconds: pet.at('seconds').number(),
            heart: pet.at('heart').number(),
            togetherSeconds: pet.at('togetherSeconds').number(),
            label: pet.at('label').string(),
          },
  };
}

function parseGreetings(r: Reader | null): GreetingsDef | null {
  if (r === null) return null;
  const lines = r.at('lines').items().map((l) => l.string());
  const replies = r.at('replies').items().map((l) => l.string());
  if (lines.length === 0 || replies.length === 0) r.fail('au moins une réplique de chaque côté attendue');
  return {
    ref: r.opt('ref')?.string() ?? '',
    from: r.at('from').time(),
    to: r.at('to').time(),
    range: r.at('range').number(),
    chance: r.at('chance').number(),
    lines,
    replies,
  };
}

/** `vie.json` (absent: aucune scène, aucun poste, pas de chat). */
export function parseVillageScenes(r: Reader | null, conditions: ConditionsReader): VillageScenes {
  if (r === null) return EMPTY_VILLAGE_SCENES;
  const bubbles = r.opt('bubbles');
  return {
    scenes: parseScenes(r.opt('scenes'), conditions),
    workPosts: parseWorkPosts(r.opt('workPosts')),
    seating: parseSeating(r.opt('seating')),
    pauses: (r.opt('pauses')?.items() ?? []).map((p) => ({
      id: id(p.at('id')),
      ref: p.opt('ref')?.string() ?? '',
      at: p.at('at').items().map((t) => t.time()),
      minutes: p.at('minutes').number(),
      clip: id(p.at('clip')),
    })),
    cat: parseCat(r.opt('cat'), conditions),
    greetings: parseGreetings(r.opt('greetings')),
    bubbleSeconds: bubbles?.at('seconds').number() ?? EMPTY_VILLAGE_SCENES.bubbleSeconds,
    bubbleRange: bubbles?.at('range').number() ?? EMPTY_VILLAGE_SCENES.bubbleRange,
  };
}

/** Les scènes et les postes ne citent que des habitants et des points connus. */
export function checkVillageScenes(
  life: VillageScenes,
  villagers: readonly string[],
  points: ReadonlySet<string> | null,
): void {
  for (const s of life.scenes) {
    for (const who of [...s.groups.flatMap((g) => g.who), ...s.lines.map((l) => l.by)]) {
      if (!villagers.includes(who)) throw new ContentError(`vie.json: scène « ${s.id} »: habitant inconnu « ${who} »`);
    }
    for (const p of s.cameFrom?.points ?? []) {
      if (points !== null && !points.has(p)) throw new ContentError(`vie.json: scène « ${s.id} »: point inconnu « ${p} »`);
    }
  }
  if (points === null) return;
  for (const p of [...life.workPosts, ...life.seating]) {
    if (!points.has(p.point)) throw new ContentError(`vie.json: point inconnu « ${p.point} »`);
  }
  const gift = life.cat?.gift ?? null;
  if (gift !== null && !points.has(gift.point)) throw new ContentError(`vie.json: chat: point inconnu « ${gift.point} »`);
}
