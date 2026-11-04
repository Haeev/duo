/**
 * Vie du village de la 0.13, seconde moitié du lot H7 (`v0-13-habitants.md`, sections 7.1 et 7.3):
 * les gestes des habitants avec le décor et leurs réactions aux joueurs, lus dans
 * `gestes-0-13.json`. Fichier à part, avec son lecteur, en attendant le format commun des gestes et
 * des scènes de la première moitié du lot (fusion sans conflit).
 *
 * Un geste se choisit d'après ce que l'état porte déjà de l'habitant (habitude, point, activité,
 * météo, heure): rien de plus n'est transmis, et l'hôte comme l'invité voient le même geste.
 */
import { ContentError, Reader } from './lecteur';
import type { Season } from './types';
import { SEASONS } from './calendrier';
import type { Weather } from '../etat/types';

const WEATHERS: readonly Weather[] = ['sunny', 'cloudy', 'rain'];
const MOUNTS = ['hand', 'chest'] as const;
const TASTES = ['loves', 'likes', 'neutral'] as const;

/** Un temps d'un geste en boucle: un clip de `personnages.glb` joué `seconds` secondes. */
export interface GestureStep {
  clip: string;
  seconds: number;
}

/** Où regarde l'habitant pendant le geste. */
export type GestureFacing =
  /** vers le centre d'un objet de la carte (`objets[].id`: banc, tombe, pommier, bâtiment) */
  | { kind: 'object'; id: string }
  /** vers un point nommé de la carte */
  | { kind: 'point'; id: string }
  /** cap de boussole en degrés (0 nord, 90 est), pour les directions sans objet (champ, vallée) */
  | { kind: 'heading'; degrees: number };

export interface GestureDef {
  id: string;
  label: string;
  villagers: string[];
  /** Habitudes du planning (champ `habit` de l'entrée en cours); vide: toutes. */
  habits: string[];
  /** Points du planning (`target`); vide: tous. */
  points: string[];
  /** Activités du planning; vide: toutes sauf la marche et la conversation. */
  activities: string[];
  /** Plage horaire `[from, to[` en minutes du jour, `null`: toute la journée. */
  from: number | null;
  to: number | null;
  weather: Weather[];
  notWeather: Weather[];
  seasons: Season[];
  /** Boucle des clips; un seul temps: le clip en boucle. */
  steps: GestureStep[];
  /** Clip qu'il faudrait à l'artiste 3D, `null` si le clip pris convient. */
  wantedClip: string | null;
  /** Accessoire tenu: en main (`hand`, prise de `toolHolds` si elle existe) ou devant soi (`chest`). */
  prop: { model: string; mount: 'hand' | 'chest' } | null;
  face: GestureFacing | null;
  /** Son placé sur l'habitant, toutes les `everySeconds` secondes, entendu à moins de `range` m. */
  sound: { id: string; everySeconds: number; range: number } | null;
}

/** Textes par habitant, en plus (ou à la place) des textes communs. */
export type TextsByVillager = Record<string, string[]>;

export interface ReactionSettings {
  maxPerVillagerPerPlayerPerDay: number;
  eveningFrom: number;
  nightFrom: number;
  /** Durée d'une bulle (s). */
  seconds: number;
  /** Distance au-delà de laquelle le joueur local ne voit pas la bulle (m). */
  bubbleRange: number;
  greet: {
    distance: number;
    waveFromLevel: number;
    waveDistance: number;
    nameFromLevel: number;
    endearmentFromLevel: number;
    stranger: string[];
    strangerEvening: string[];
    named: string[];
    namedEvening: string[];
    dear: string[];
    dearEvening: string[];
  };
  weather: { distance: number; rain: string[] };
  outfit: { distance: number; fromLevel: number; maxPerPlayerPerDay: number; texts: string[]; byVillager: TextsByVillager };
  haircut: { distance: number; fromLevel: number; texts: string[]; byVillager: TextsByVillager };
  catch: { distance: number; minutes: number; rarities: string[]; texts: string[]; byVillager: TextsByVillager };
  held: { distance: number; texts: string[] };
  night: { distance: number; texts: string[] };
  birthday: { distance: number; texts: string[] };
  together: { distance: number; playersDistance: number; texts: string[] };
  giftOther: {
    distance: number;
    days: number;
    tastes: ('loves' | 'likes' | 'neutral')[];
    texts: string[];
    /** Paires de proches (familles et amitiés de la section 2.4). */
    close: [string, string][];
  };
}

export interface VillageLife {
  gestures: GestureDef[];
  /** `null`: aucune réaction (fichier absent). */
  reactions: ReactionSettings | null;
  /** Appellations des habitants (`endearment` des données des habitants), par identifiant. */
  endearments: Record<string, string>;
}

export const EMPTY_VILLAGE_LIFE: VillageLife = { gestures: [], reactions: null, endearments: {} };

function strings(r: Reader | null): string[] {
  return r === null ? [] : r.items().map((x) => x.string());
}

function texts(r: Reader): string[] {
  const list = strings(r);
  if (list.length === 0) r.fail('au moins un texte attendu');
  return list;
}

function byVillager(r: Reader | null): TextsByVillager {
  const out: TextsByVillager = {};
  if (r === null) return out;
  for (const [key, value] of r.entries()) out[key] = texts(value);
  return out;
}

function time(r: Reader | null): number | null {
  return r === null ? null : r.time();
}

function parseFacing(r: Reader | null): GestureFacing | null {
  if (r === null) return null;
  const object = r.opt('object');
  if (object !== null) return { kind: 'object', id: object.string() };
  const point = r.opt('point');
  if (point !== null) return { kind: 'point', id: point.string() };
  return { kind: 'heading', degrees: r.at('heading').number() };
}

function parseGesture(r: Reader): GestureDef {
  const stepsReader = r.opt('steps');
  const steps: GestureStep[] =
    stepsReader === null
      ? [{ clip: r.at('clip').string(), seconds: 0 }]
      : stepsReader.items().map((s) => ({ clip: s.at('clip').string(), seconds: s.at('seconds').number() }));
  if (steps.length === 0) r.fail('geste sans clip');
  if (steps.length > 1 && steps.some((s) => !(s.seconds > 0))) r.fail('chaque temps d\'une boucle dure plus de 0 s');
  const prop = r.opt('prop');
  const sound = r.opt('sound');
  const villagers = strings(r.at('villagers'));
  if (villagers.length === 0) r.fail('geste sans habitant');
  return {
    id: r.at('id').string(),
    label: r.at('label').string(),
    villagers,
    habits: strings(r.opt('habits')),
    points: strings(r.opt('points')),
    activities: strings(r.opt('activities')),
    from: time(r.opt('from')),
    to: time(r.opt('to')),
    weather: r.opt('weather')?.items().map((w) => w.oneOf(WEATHERS)) ?? [],
    notWeather: r.opt('notWeather')?.items().map((w) => w.oneOf(WEATHERS)) ?? [],
    seasons: r.opt('seasons')?.items().map((s) => s.oneOf(SEASONS)) ?? [],
    steps,
    wantedClip: r.opt('wantedClip')?.string() ?? null,
    prop: prop === null ? null : { model: prop.at('model').string(), mount: prop.at('mount').oneOf(MOUNTS) },
    face: parseFacing(r.opt('face')),
    sound:
      sound === null
        ? null
        : {
            id: sound.at('id').string(),
            everySeconds: sound.at('everySeconds').number(),
            range: sound.at('range').number(),
          },
  };
}

function parseReactions(r: Reader): ReactionSettings {
  const g = r.at('greet');
  const o = r.at('outfit');
  const h = r.at('haircut');
  const c = r.at('catch');
  const t = r.at('together');
  const go = r.at('giftOther');
  const distance = (x: Reader): number => x.at('distance').number();
  return {
    maxPerVillagerPerPlayerPerDay: r.at('maxPerVillagerPerPlayerPerDay').integer(1, 100),
    eveningFrom: r.at('eveningFrom').time(),
    nightFrom: r.at('nightFrom').time(),
    seconds: r.at('seconds').number(),
    bubbleRange: r.at('bubbleRange').number(),
    greet: {
      distance: distance(g),
      waveFromLevel: g.at('waveFromLevel').integer(0, 10),
      waveDistance: g.at('waveDistance').number(),
      nameFromLevel: g.at('nameFromLevel').integer(0, 10),
      endearmentFromLevel: g.at('endearmentFromLevel').integer(0, 10),
      stranger: texts(g.at('stranger')),
      strangerEvening: texts(g.at('strangerEvening')),
      named: texts(g.at('named')),
      namedEvening: texts(g.at('namedEvening')),
      dear: texts(g.at('dear')),
      dearEvening: texts(g.at('dearEvening')),
    },
    weather: { distance: distance(r.at('weather')), rain: texts(r.at('weather').at('rain')) },
    outfit: {
      distance: distance(o),
      fromLevel: o.at('fromLevel').integer(0, 10),
      maxPerPlayerPerDay: o.at('maxPerPlayerPerDay').integer(1, 100),
      texts: texts(o.at('texts')),
      byVillager: byVillager(o.opt('byVillager')),
    },
    haircut: {
      distance: distance(h),
      fromLevel: h.at('fromLevel').integer(0, 10),
      texts: texts(h.at('texts')),
      byVillager: byVillager(h.opt('byVillager')),
    },
    catch: {
      distance: distance(c),
      minutes: c.at('minutes').number(),
      rarities: strings(c.at('rarities')),
      texts: texts(c.at('texts')),
      byVillager: byVillager(c.opt('byVillager')),
    },
    held: { distance: distance(r.at('held')), texts: texts(r.at('held').at('texts')) },
    night: { distance: distance(r.at('night')), texts: texts(r.at('night').at('texts')) },
    birthday: { distance: distance(r.at('birthday')), texts: texts(r.at('birthday').at('texts')) },
    together: { distance: distance(t), playersDistance: t.at('playersDistance').number(), texts: texts(t.at('texts')) },
    giftOther: {
      distance: distance(go),
      days: go.at('days').integer(0, 30),
      tastes: go.at('tastes').items().map((x) => x.oneOf(TASTES)),
      texts: texts(go.at('texts')),
      close: go
        .at('close')
        .items()
        .map((pair): [string, string] => {
          const list = strings(pair);
          const a = list[0];
          const b = list[1];
          if (a === undefined || b === undefined || list.length !== 2) return pair.fail('paire de deux habitants attendue');
          return [a, b];
        }),
    },
  };
}

/** Appellations (`endearment`) relues dans les fichiers des habitants (le dernier qui la dit l'emporte). */
function endearmentsOf(files: readonly unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [index, file] of files.entries()) {
    const r = new Reader(`habitants (${String(index)})`, '', file);
    for (const v of r.opt('villagers')?.items() ?? []) {
      const e = v.opt('endearment');
      if (e !== null && !e.isNull()) out[v.at('id').string()] = e.string();
    }
  }
  return out;
}

/**
 * Lit `gestes-0-13.json` (absent: aucun geste, aucune réaction). Un habitant ou une habitude absents
 * du contenu ne cassent rien (le geste ne se joue jamais): les essais réduisent souvent les
 * habitants. `gestesReferences` dit ce qui manque, pour le test des données du jeu.
 */
export function parseVillageLife(raw: unknown, villagerFiles: readonly unknown[]): VillageLife {
  const endearments = endearmentsOf(villagerFiles);
  if (raw === undefined) return { ...EMPTY_VILLAGE_LIFE, endearments };
  const r = new Reader('gestes-0-13.json', '', raw);
  r.at('version').integer(1, 1);
  const gestures = r.at('gestures').items().map(parseGesture);
  const ids = new Set<string>();
  for (const g of gestures) {
    if (ids.has(g.id)) throw new ContentError(`gestes-0-13.json: geste en double « ${g.id} »`);
    ids.add(g.id);
  }
  const reactions = r.opt('reactions');
  return { gestures, reactions: reactions === null ? null : parseReactions(reactions), endearments };
}

/** Références des gestes et des réactions absentes du contenu (habitants, habitudes), vide si tout est là. */
export function gesturesReferences(
  life: VillageLife,
  villagers: readonly { id: string; habits: readonly { id: string }[] }[],
): string[] {
  const missing: string[] = [];
  const known = (who: string): boolean => villagers.some((v) => v.id === who);
  for (const g of life.gestures) {
    for (const who of g.villagers) if (!known(who)) missing.push(`${g.id}: habitant « ${who} »`);
    for (const habit of g.habits) {
      const owned = g.villagers.some(
        (who) => villagers.find((v) => v.id === who)?.habits.some((h) => h.id === habit) === true,
      );
      if (!owned) missing.push(`${g.id}: habitude « ${habit} »`);
    }
  }
  for (const pair of life.reactions?.giftOther.close ?? [])
    for (const who of pair) if (!known(who)) missing.push(`proches: « ${who} »`);
  return missing;
}
