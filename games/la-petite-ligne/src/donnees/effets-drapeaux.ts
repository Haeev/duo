/**
 * Effets en jeu des drapeaux que posent les quêtes de la 0.13 (`reglages.flagEffects`): planches de
 * la scie affûtée, banc d'Hortense, chaises du café, menuiserie du samedi, soupe du jour, souper de
 * la pension, jumelles prêtées, roue du moulin. Chaque effet nomme son drapeau: sans le drapeau,
 * rien ne change. Toutes les valeurs viennent de `reglages.json`; la clé est facultative.
 */
import type { Reader } from './lecteur';

/** Jours de la semaine dans l'ordre de `weekdayOf` (0: samedi). */
const WEEKDAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

export interface FlagMeal {
  id: string;
  /** Verbe de visée affiché (`textes-interface.json`, `extra.aim.verbs`). */
  verb: 'soup' | 'supper';
  flag: string;
  /** Point de la carte où l'on commande. */
  point: string;
  /** Bâtiment où l'on doit se trouver. */
  building: string;
  /** Rangs de `weekdayOf`; vide: tous les jours. */
  weekdays: number[];
  from: number;
  to: number;
  price: number;
  item: string;
  perPlayerPerDay: number;
  /** Clés de `textes.json` (messages). */
  offText: string;
  doneText: string;
}

export interface FlagEffects {
  /** Unités de plus par fabrication (`extra`) quand le drapeau est levé. */
  recipeBonus: { flag: string; recipe: string; extra: number }[];
  /** Chantier de la carte posé dès que le drapeau est levé (sans passer par le tableau du quai). */
  works: { flag: string; improvement: string }[];
  /** Drapeaux levés dès le départ si aucune donnée du jeu ne peut les poser. */
  autoFlags: string[];
  /** Sièges d'une place à un seul siège, utilisables quand le drapeau est levé. */
  chairs: { flag: string; seats: { id: string; x: number; y: number; rotation: number }[] }[];
  /** Menuiserie: ouverte aux heures données, ces jours-là, une fois le drapeau levé (ou pendant la quête). */
  joinery: { building: string; flag: string; quest: string; weekdays: number[]; hours: [number, number][] } | null;
  meals: FlagMeal[];
  /** Objets animés de la carte qui ne tournent qu'une fois le drapeau levé (la roue du moulin). */
  spins: { model: string; flag: string }[];
  /** Objet prêté à chaque joueur ces jours-là, repris au matin suivant. */
  loans: { flag: string; item: string; weekdays: number[]; lentText: string; returnText: string }[];
}

export const NO_FLAG_EFFECTS: FlagEffects = {
  recipeBonus: [],
  works: [],
  autoFlags: [],
  chairs: [],
  joinery: null,
  meals: [],
  spins: [],
  loans: [],
};

function weekdays(r: Reader | null): number[] {
  return r === null ? [] : r.items().map((w) => WEEKDAYS.indexOf(w.oneOf(WEEKDAYS)));
}

export function parseFlagEffects(r: Reader | null): FlagEffects {
  if (r === null) return NO_FLAG_EFFECTS;
  const list = (key: string): Reader[] => r.opt(key)?.items() ?? [];
  const joinery = r.opt('joinery');
  return {
    recipeBonus: list('recipeBonus').map((x) => ({
      flag: x.at('flag').string(),
      recipe: x.at('recipe').string(),
      extra: x.at('extra').integer(1, 20),
    })),
    works: list('works').map((x) => ({ flag: x.at('flag').string(), improvement: x.at('improvement').string() })),
    autoFlags: r.opt('autoFlags')?.stringList() ?? [],
    chairs: list('chairs').map((x) => ({
      flag: x.at('flag').string(),
      seats: x
        .at('seats')
        .items()
        .map((s) => ({
          id: s.at('id').string(),
          x: s.at('x').number(),
          y: s.at('y').number(),
          rotation: s.at('rotation').integer(0, 3),
        })),
    })),
    joinery:
      joinery === null
        ? null
        : {
            building: joinery.at('building').string(),
            flag: joinery.at('flag').string(),
            quest: joinery.at('quest').string(),
            weekdays: weekdays(joinery.opt('weekdays')),
            hours: joinery
              .at('hours')
              .items()
              .map((h): [number, number] => {
                const [from, to] = h.items();
                if (from === undefined || to === undefined) return h.fail('[début, fin] attendu');
                return [from.time(), to.time()];
              }),
          },
    meals: list('meals').map((x) => ({
      id: x.at('id').string(),
      verb: x.at('verb').oneOf(['soup', 'supper'] as const),
      flag: x.at('flag').string(),
      point: x.at('point').string(),
      building: x.at('building').string(),
      weekdays: weekdays(x.opt('weekdays')),
      from: x.at('from').time(),
      to: x.at('to').time(),
      price: x.at('price').integer(1, 1000),
      item: x.at('item').string(),
      perPlayerPerDay: x.at('perPlayerPerDay').integer(1, 10),
      offText: x.at('offText').string(),
      doneText: x.at('doneText').string(),
    })),
    spins: list('spins').map((x) => ({ model: x.at('model').string(), flag: x.at('flag').string() })),
    loans: list('loans').map((x) => ({
      flag: x.at('flag').string(),
      item: x.at('item').string(),
      weekdays: weekdays(x.opt('weekdays')),
      lentText: x.at('lentText').string(),
      returnText: x.at('returnText').string(),
    })),
  };
}
