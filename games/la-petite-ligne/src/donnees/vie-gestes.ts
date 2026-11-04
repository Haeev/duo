/**
 * Gestes avec le décor (0.13, lot H7, section 7.1 de `v0-13-habitants.md`; README des données
 * 2.14): lecture de `gestures[]` dans `vie.json`. Format de base posé avec les scènes; le dev des
 * gestes l'étend ici, sans toucher à `vie.ts`.
 */
import type { Reader } from './lecteur';
import type { Condition } from './types';

/** Le verbe d'un geste: Agir (appui), Agir maintenu, Examiner (section 7.0: aucune touche nouvelle). */
export type DecorVerb = 'act' | 'hold' | 'examine';

/**
 * La mécanique du geste:
 * - `plain`: un appui (ou un maintien, selon le verbe), un effet;
 * - `charge`: maintenir pour charger, relâcher pour lancer (ricochets, quilles);
 * - `rhythm`: `rhythmSteps` appuis, chacun dans les `rhythmSeconds` du précédent (le gué);
 * - `dwell`: rester `dwellSeconds` sans bouger, sous la pluie si `rain` (l'abri, la berceuse du moulin);
 * - `pages`: texte fixe du jour ou de la semaine, ou page suivante à chaque regard (affiches, registre);
 * - `forecast`: le coq lit la météo de demain, juste quatre fois sur cinq;
 * - `together`: demande les deux joueurs dans les `duo.windowSeconds` (gravure du banc, vanne).
 */
export type DecorKind = 'plain' | 'charge' | 'rhythm' | 'dwell' | 'pages' | 'forecast' | 'together';

/** Sons de la liste du son (`AUDIO_SETTINGS.village.events`) émis par un geste, avec `by` et `at`. */
export const DECOR_SOUND_EVENTS = [
  'washhouse_scrub',
  'skim_stone',
  'well_peek',
  'well_shout',
  'lookout_shout',
  'sluice_opened',
  'bell_rope_pull',
  'bells_rung',
  'harmonium_note',
  'harmonium_chord',
] as const;
export type DecorSoundEvent = (typeof DECOR_SOUND_EVENTS)[number];

/** Une réplique d'un geste, avec ses conditions (saison, temps, heure...) et une étiquette facultative. */
export interface DecorLineDef {
  text: string;
  when: Condition[];
  /** Étiquette: une réplique étiquetée ne se dit que quand le geste demande cette étiquette (`forecast`, résultat d'un lancer). */
  tag: string | null;
  /** Habitant qui doit être à moins de 6 m (visible) pour que la réplique se dise; `null`: personne. */
  near: string | null;
}

/** La variante à deux: l'autre joueur a fait le même geste dans les `windowSeconds`. */
export interface DecorDuoDef {
  windowSeconds: number;
  lines: DecorLineDef[];
  /** Cœur donné à chacun, une fois par jour. */
  heart: number;
  /** Texte du souvenir partagé (notification), une fois par partie; `null`: aucun. */
  memory: string | null;
  /** Son de la variante à deux (l'accord de l'harmonium), à la place de celui du geste; `null`: celui du geste. */
  event: DecorSoundEvent | null;
}

/** Un lieu donné par ses coordonnées, quand aucun point de la carte ne convient. */
export interface DecorSpot {
  x: number;
  y: number;
}

export interface DecorGestureDef {
  id: string;
  /** Numéro de la table 7.1. */
  ref: number;
  tier: 'P0' | 'P1';
  /** Points de la carte où le geste se fait (`points` de `halte.json`). */
  points: string[];
  /** Lieux donnés par coordonnées (plan de la carte), en plus des points. */
  spots: DecorSpot[];
  verb: DecorVerb;
  kind: DecorKind;
  /** Conditions du geste (saison, temps, quête...); vide: toujours. */
  when: Condition[];
  /** Invite montrée au survol (« S'asseoir et se pencher »). */
  label: string;
  /** Clip du joueur (`personnages.glb`), ou `null`: aucun. */
  clip: string | null;
  /** Durée du geste du personnage (s). */
  clipSeconds: number;
  /** Son du geste (nom du catalogue), ou `null`; joué par `decor_gesture` quand `event` est nul. */
  sound: string | null;
  /** Événement du son (`DECOR_SOUND_EVENTS`), ou `null`. */
  event: DecorSoundEvent | null;
  /** Un second événement après le premier (la volée qui suit la corde tirée), ou `null`. */
  then: { event: DecorSoundEvent; seconds: number } | null;
  /** Réserve de répliques, tirée « la moins récente » (section 7.0). */
  lines: DecorLineDef[];
  /** Une réplique tous les `lineEvery` coups (un maintien répété ne parle pas à chaque coup). */
  lineEvery: number;
  /** Montrer le score du lancer (« 7 quilles. »). */
  showScore: boolean;
  /** Cœur, Repos et lien à chaque fois (le café), sinon à la première fois du jour seulement. */
  effectsEvery: boolean;
  /** Remplit l'arrosoir tenu (la pompe des jardins). */
  fillCan: boolean;
  /** Choix de la réplique: la moins récente, une par semaine (rang de la semaine), ou la suivante à chaque fois. */
  pick: 'least_recent' | 'week' | 'cycle';
  /** Repos entre deux gestes du même joueur (s). */
  cooldownSeconds: number;
  /** Portée (m) depuis le point; `null`: la portée d'action des réglages. */
  reach: number | null;
  /** Combien de fois par jour et par joueur (0: sans limite). */
  perDay: number;
  /** Maintien: durée avant l'effet (`hold`), puis répétition toutes les `repeatSeconds` (0: une fois). */
  holdSeconds: number;
  repeatSeconds: number;
  /** `charge`: durée idéale de maintien (s), durée maximale, et rebonds au plus. */
  chargeIdeal: number;
  chargeMax: number;
  maxScore: number;
  /** `rhythm`, `dwell`. */
  rhythmSteps: number;
  rhythmSeconds: number;
  dwellSeconds: number;
  /** Seulement sous la pluie (l'abri, les flaques). */
  rain: boolean;
  /** Objets en main acceptés (un seul est pris), vide: aucun requis. */
  heldItems: string[];
  /** Habitant qui doit être là (visible, à moins de 6 m), ou `null`. */
  villagerPresent: string | null;
  /** Effets sur le joueur: Cœur et endurance (« Repos ») gagnés, aubrins payés. */
  heart: number;
  rest: number;
  cost: number;
  /** Lien gagné avec un habitant (une fois par semaine et par geste). */
  bond: { villager: string; amount: number } | null;
  /** Les deux variantes: fait à deux. */
  duo: DecorDuoDef | null;
  /** Une seule fois par partie (le drapeau écrit); `null`: sans limite. */
  onceFlag: string | null;
  /** Drapeau écrit au geste réussi (pour une durée de `flagDays` jours, 0: pour toujours). */
  setFlag: string | null;
  flagDays: number;
  /** Trouvaille: un objet donné avec une chance sur `findOneIn` (0: aucune), au plus une par jour. */
  find: { item: string; count: number; oneIn: number } | null;
}

const ID = /^[a-z][a-z0-9_]*$/;

function id(r: Reader): string {
  const value = r.string();
  if (!ID.test(value)) r.fail(`identifiant « snake_case » attendu, reçu « ${value} »`);
  return value;
}

type Conditions = (r: Reader | null) => Condition[];

function parseLines(r: Reader | null, conditions: Conditions): DecorLineDef[] {
  if (r === null) return [];
  return r.items().map((l) => ({
    text: l.at('text').string(),
    when: conditions(l.opt('when')),
    tag: l.opt('tag')?.string() ?? null,
    near: optNull(l.opt('near'))?.string() ?? null,
  }));
}

function optNull(r: Reader | null): Reader | null {
  return r === null || r.isNull() ? null : r;
}

function parseDuo(r: Reader | null, conditions: Conditions): DecorDuoDef | null {
  const d = optNull(r);
  if (d === null) return null;
  return {
    windowSeconds: d.at('windowSeconds').number(),
    lines: parseLines(d.opt('lines'), conditions),
    heart: d.opt('heart')?.number() ?? 0,
    memory: optNull(d.opt('memory'))?.string() ?? null,
    event: optNull(d.opt('event'))?.oneOf(DECOR_SOUND_EVENTS) ?? null,
  };
}

export function parseDecorGestures(r: Reader | null, conditions: Conditions): DecorGestureDef[] {
  if (r === null) return [];
  const seen = new Set<string>();
  return r.items().map((g): DecorGestureDef => {
    const gestureId = id(g.at('id'));
    if (seen.has(gestureId)) g.fail(`geste en double « ${gestureId} »`);
    seen.add(gestureId);
    const clip = optNull(g.opt('clip'));
    const sound = optNull(g.opt('sound'));
    const event = optNull(g.opt('event'));
    const bond = optNull(g.opt('bond'));
    const then = optNull(g.opt('then'));
    const find = optNull(g.opt('find'));
    const points = g.opt('points')?.items().map(id) ?? [];
    const spots = (g.opt('spots')?.items() ?? []).map((s) => ({
      x: s.at('x').number(),
      y: s.at('y').number(),
    }));
    if (points.length === 0 && spots.length === 0)
      g.fail(`geste « ${gestureId} »: ni point, ni lieu`);
    return {
      id: gestureId,
      ref: g.opt('ref')?.integer(1, 31) ?? 0,
      tier: g.opt('tier')?.oneOf(['P0', 'P1'] as const) ?? 'P0',
      points,
      spots,
      verb: g.at('verb').oneOf(['act', 'hold', 'examine'] as const),
      kind:
        g
          .opt('kind')
          ?.oneOf([
            'plain',
            'charge',
            'rhythm',
            'dwell',
            'pages',
            'forecast',
            'together',
          ] as const) ?? 'plain',
      when: conditions(g.opt('when')),
      label: g.at('label').string(),
      clip: clip === null ? null : id(clip),
      clipSeconds: g.opt('clipSeconds')?.number() ?? 0.8,
      sound: sound === null ? null : sound.string(),
      event: event === null ? null : event.oneOf(DECOR_SOUND_EVENTS),
      then:
        then === null
          ? null
          : {
              event: then.at('event').oneOf(DECOR_SOUND_EVENTS),
              seconds: then.at('seconds').number(),
            },
      lines: parseLines(g.opt('lines'), conditions),
      lineEvery: g.opt('lineEvery')?.integer(1) ?? 1,
      showScore: g.opt('showScore')?.boolean() ?? false,
      effectsEvery: g.opt('effectsEvery')?.boolean() ?? false,
      fillCan: g.opt('fillCan')?.boolean() ?? false,
      pick: g.opt('pick')?.oneOf(['least_recent', 'week', 'cycle'] as const) ?? 'least_recent',
      cooldownSeconds: g.opt('cooldownSeconds')?.number() ?? 0,
      reach: optNull(g.opt('reach'))?.number() ?? null,
      perDay: g.opt('perDay')?.integer(0) ?? 0,
      holdSeconds: g.opt('holdSeconds')?.number() ?? 0,
      repeatSeconds: g.opt('repeatSeconds')?.number() ?? 0,
      chargeIdeal: g.opt('chargeIdeal')?.number() ?? 0.6,
      chargeMax: g.opt('chargeMax')?.number() ?? 1.6,
      maxScore: g.opt('maxScore')?.integer(1) ?? 7,
      rhythmSteps: g.opt('rhythmSteps')?.integer(1) ?? 3,
      rhythmSeconds: g.opt('rhythmSeconds')?.number() ?? 1.6,
      dwellSeconds: g.opt('dwellSeconds')?.number() ?? 2,
      rain: g.opt('rain')?.boolean() ?? false,
      heldItems: g.opt('heldItems')?.stringList() ?? [],
      villagerPresent: optNull(g.opt('villagerPresent'))?.string() ?? null,
      heart: g.opt('heart')?.number() ?? 0,
      rest: g.opt('rest')?.number() ?? 0,
      cost: g.opt('cost')?.integer(0) ?? 0,
      bond:
        bond === null
          ? null
          : { villager: bond.at('villager').string(), amount: bond.at('amount').number() },
      duo: parseDuo(g.opt('duo'), conditions),
      onceFlag: optNull(g.opt('onceFlag'))?.string() ?? null,
      setFlag: optNull(g.opt('setFlag'))?.string() ?? null,
      flagDays: g.opt('flagDays')?.integer(0) ?? 0,
      find:
        find === null
          ? null
          : {
              item: find.at('item').string(),
              count: find.opt('count')?.integer(1) ?? 1,
              oneIn: find.at('oneIn').integer(1),
            },
    };
  });
}
