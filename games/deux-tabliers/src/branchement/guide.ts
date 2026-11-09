/**
 * Guide du premier service (retours de la séance du 2026-11-08: « on ne comprend pas ce qu'il
 * faut faire »). Simone dit l'étape en cours et le poste à viser, du client à la caisse jusqu'à la
 * plonge; la liste « À faire » coche ce qui est fait. Tout se déduit du monde partagé, sans état
 * propre: les deux machines voient la même étape, une sauvegarde reprend où l'on en était.
 * Lu par l'interface (carte « À faire ») et par le rendu (poste surligné).
 */
import type { Content } from '../donnees/charger';
import type { ObjectState, PlayerIndex, World } from '../etat/monde';
import { gameStation, itemOf, recipeOf } from '../service/regles';
import type { Recipe } from '../service/donnees';
import type { Ticket } from '../service/etat';
import { furnitureType, heldObject, objectOnSlot } from '../simulation/monde';
import { installGuideOf } from '../installation/guide';

/** Ce que le guide surligne: un meuble (poste) ou un objet posé. */
export type GuideFocus =
  | { readonly kind: 'furniture'; readonly id: string }
  | { readonly kind: 'object'; readonly id: number };

export interface GuideStep {
  readonly label: string;
  /** Guide d'installation: cochée d'après le monde (sinon, celles d'avant l'étape en cours). */
  readonly done?: boolean;
  readonly optional?: boolean;
  /** Chapitre (« Ouvrir le local »): la carte replie les chapitres finis. */
  readonly chapter?: string;
}

export interface GuideView {
  /** Titre de la carte (« Simone te guide · l'installation »), sinon celui du premier service. */
  readonly title?: string;
  /** Recette suivie (« Café crème »), `null` sans commande en cours. */
  readonly recipe: string | null;
  readonly steps: readonly GuideStep[];
  /** Index de l'étape en cours dans `steps` (`steps.length`: tout est fait). */
  readonly current: number;
  /** Ce que dit Simone pour l'étape en cours. */
  readonly say: string;
  readonly focus: GuideFocus | null;
}

const DIRTY = new Set(['tasse-sale', 'assiette-sale', 'verre-sale']);

/** Étapes d'une recette au poste, dans l'ordre des gestes. */
function recipeSteps(recipe: Recipe | undefined): string[] {
  const out: string[] = [];
  const vessel =
    recipe?.vessel === 'assiette'
      ? 'une assiette'
      : recipe?.vessel === 'verre'
        ? 'un verre'
        : 'une tasse';
  out.push(`Prendre ${vessel} sur la pile de vaisselle`);
  for (const s of recipe?.steps ?? []) {
    switch (s.station) {
      case 'espresso':
        out.push('Moudre une dose au moulin', 'Extraire le café au groupe');
        break;
      case 'vapeur':
        out.push('Mousser le lait à la buse vapeur');
        break;
      case 'bouilloire':
        out.push("Chauffer l'eau et verser à la bouilloire");
        break;
      case 'vitrine':
        out.push('Servir la part à la cloche à viennoiseries');
        break;
      case 'plan':
      case 'frigo':
        out.push('Préparer au plan de travail du frigo');
        break;
      case 'agrumes':
        out.push('Presser au presse-agrumes');
        break;
      case 'creperie':
        out.push('Cuire à la crêpière');
        break;
    }
  }
  return out;
}

/** Étapes complètes d'un service guidé pour cette recette. */
export function guideSteps(content: Content, recipeId: string | null): string[] {
  const recipe = recipeId === null ? undefined : recipeOf(content, recipeId);
  return [
    'Prendre la commande et encaisser à la caisse',
    'Prendre le ticket au rail',
    ...recipeSteps(recipe),
    'Poser la commande sur le passe',
    'Le client prend son plateau',
    'Débarrasser la table et laver à la plonge',
  ];
}

/** Gestes d'une recette, pour l'aide consultable (« Café crème : tasse, moulin, groupe, buse »). */
export function recipeHelp(content: Content, recipeId: string): string[] {
  return recipeSteps(recipeOf(content, recipeId));
}

function furnitureOfStation(
  content: Content,
  world: World,
  stations: readonly string[],
): string | null {
  for (const f of world.furniture) {
    const st = furnitureType(content, f).station;
    if (st !== null && stations.includes(st) && !world.service.groupsOut.includes(f.id))
      return f.id;
  }
  return null;
}

/** Meuble où est posé un objet (`null` en main). */
function placedOn(o: ObjectState | undefined): string | null {
  return o?.at.kind === 'slot' ? o.at.furniture : null;
}

/** Ticket suivi: celui du joueur, puis un libre, puis le premier. */
function followed(world: World, player: PlayerIndex): Ticket | undefined {
  const t = world.service.tickets;
  return (
    t.find((x) => x.taker === player && x.status === 'open') ??
    t.find((x) => x.taker === null) ??
    t[0]
  );
}

/** Le guide est-il actif: premier jour ouvert, café en service. */
export function guideActive(world: World): boolean {
  const s = world.clientele;
  return s.openDays === 0 && (s.phase === 'service' || s.phase === 'closing');
}

/**
 * Étape en cours pour ce joueur, ou `null` quand le guide se tait (hors du premier jour ouvert,
 * sans `always`). `always`: l'aide de recette des jours suivants (même déduction).
 */
export function guideOf(
  content: Content,
  world: World,
  player: PlayerIndex,
  always = false,
): GuideView | null {
  // Démo v0.3: une maison qui s'installe suit d'abord le guide de l'installation.
  if (!always) {
    const install = installGuideOf(content, world, player);
    if (install !== null) return install;
  }
  if (!always && !guideActive(world)) return null;
  const sv = world.service;
  const held = heldObject(world, player);
  const ticket = followed(world, player);
  const waiting = sv.waiting[0];
  const recipeId =
    ticket?.articles.find((a) => a.object === null || !finished(content, world, a.object))
      ?.recipe ??
    ticket?.articles[0]?.recipe ??
    waiting?.articles[0]?.recipe ??
    null;
  const recipe = recipeId === null ? undefined : recipeOf(content, recipeId);
  const steps = guideSteps(content, recipeId).map((label) => ({ label }));
  const n = steps.length;
  const view = (current: number, say: string, focus: GuideFocus | null): GuideView => ({
    recipe: recipe?.label ?? null,
    steps,
    current,
    say,
    focus,
  });
  const at = (stations: readonly string[]): GuideFocus | null => {
    const id = furnitureOfStation(content, world, stations);
    return id === null ? null : { kind: 'furniture', id };
  };

  // Vaisselle sale en main: la plonge.
  if (held !== undefined && DIRTY.has(held.type))
    return view(
      n - 1,
      'Porte la vaisselle sale à la plonge et maintiens E pour la laver.',
      at(['plonge']),
    );

  if (ticket === undefined) {
    if (waiting !== undefined)
      return view(
        0,
        'Un client attend : maintiens E sur la caisse pour prendre sa commande. Il paie tout de suite.',
        at(['caisse']),
      );
    const dirty = world.objects.find((o) => {
      if (!DIRTY.has(o.type)) return false;
      const on = world.furniture.find((f) => f.id === placedOn(o));
      return on !== undefined && furnitureType(content, on).station === null;
    });
    if (dirty !== undefined)
      return view(
        n - 1,
        'Une tasse sale attend sur une table : vise-la et appuie sur E pour la débarrasser.',
        { kind: 'object', id: dirty.id },
      );
    const backlog = sv.dirtyBacklog.tasse + sv.dirtyBacklog.assiette + sv.dirtyBacklog.verre;
    if (backlog > 0)
      return view(
        n - 1,
        'De la vaisselle sale attend : maintiens E sur la plonge pour la laver.',
        at(['plonge']),
      );
    return view(0, 'Tout est propre. Le prochain client arrive bientôt à la caisse.', null);
  }
  if (ticket.taker === null)
    return view(
      1,
      'Le ticket est au rail, au-dessus du passe : vise-le et appuie sur E pour le prendre.',
      at(['rail']),
    );
  if (ticket.status === 'ready')
    return view(n - 2, 'Tout est sur le passe : le client vient chercher son plateau.', null);

  const article = ticket.articles.find(
    (a) => a.object === null || !finished(content, world, a.object),
  );
  const passe = at(['passe']) ?? { kind: 'furniture', id: 'station-3' };
  if (article === undefined || recipe === undefined) {
    const ready = held !== undefined && recipeOf(content, held.type) !== undefined;
    return view(
      n - 3,
      ready
        ? 'Pose la commande sur le passe : vise un emplacement libre et appuie sur R.'
        : 'Reprends la commande et pose-la sur le passe (R).',
      passe,
    );
  }
  const vesselLabel =
    recipe.vessel === 'assiette'
      ? 'une assiette'
      : recipe.vessel === 'verre'
        ? 'un verre'
        : 'une tasse';
  const first = recipe.steps[0];
  const firstStation = first === undefined ? null : gameStation(content, first.station);
  // Index de la première étape du poste dans la liste: commande, ticket, vaisselle, gestes.
  const base = 3;
  const stepIndex = (k: number): number => {
    let i = base;
    for (let j = 0; j < k; j++) i += recipe.steps[j]?.station === 'espresso' ? 2 : 1;
    return i;
  };

  // Pas encore de récipient engagé: une tasse propre en main, sur le poste, ou à prendre.
  if (article.object === null) {
    if (firstStation === null) return view(2, '', null);
    const station = at([firstStation]);
    const onStation =
      station?.kind === 'furniture' ? onFirstSlot(content, world, station.id) : undefined;
    if (held?.type === recipe.vessel)
      return view(
        2 + 1,
        `Pose ${vesselLabel} ${placeWord(firstStation)} : vise-le et appuie sur R.`,
        station,
      );
    if (onStation === undefined)
      return view(
        2,
        `Prends ${vesselLabel} sur la pile de vaisselle, au bout du comptoir (E).`,
        at(['vaisselle']),
      );
    return stationSay(firstStation, 0, station?.kind === 'furniture' ? station.id : null);
  }

  const item = itemOf(sv, article.object);
  const k = item?.step ?? 0;
  const step = recipe.steps[k];
  if (step === undefined)
    return view(
      n - 3,
      'Pose la commande sur le passe : vise un emplacement libre et appuie sur R.',
      passe,
    );
  const station = gameStation(content, step.station);
  const obj = world.objects.find((o) => o.id === article.object);
  const where = at([station]);
  const onFurniture = world.furniture.find((f) => f.id === placedOn(obj));
  const there =
    onFurniture !== undefined && furnitureType(content, onFurniture).station === station;
  if (!there) {
    if (obj?.at.kind !== 'hand' && obj !== undefined)
      return view(
        stepIndex(k),
        `Reprends ta ${obj.type === 'tasse-cafe' ? 'tasse de café' : 'préparation'} (E), puis pose-la ${placeWord(station)} (R).`,
        { kind: 'object', id: obj.id },
      );
    return view(stepIndex(k), `Pose-la ${placeWord(station)} : vise et appuie sur R.`, where);
  }
  return stationSay(station, k, onFurniture.id);

  function stationSay(st: string, k2: number, on: string | null = null): GuideView {
    const i = stepIndex(k2);
    const where2: GuideFocus | null = on !== null ? { kind: 'furniture', id: on } : at([st]);
    switch (st) {
      case 'groupe': {
        const running = sv.processes.some((p) => p.kind === 'extraction');
        if (running)
          return view(
            i + 1,
            "L'extraction coule : appuie sur E sur le groupe quand l'anneau entre dans la zone verte.",
            where2,
          );
        if (sv.doses === 0)
          return view(
            i,
            'Mouds une dose : maintiens E sur le moulin, à droite de la machine.',
            at(['moulin', 'moulin-dose']),
          );
        return view(
          i + 1,
          "La dose est prête : appuie sur E sur le groupe pour lancer l'extraction.",
          where2,
        );
      }
      case 'vapeur':
        return view(
          i,
          'Maintiens E sur la buse vapeur et relâche quand le lait est dans la zone verte (vers 60 °C).',
          where2,
        );
      case 'bouilloire':
        return view(
          i,
          "Appuie sur E sur la bouilloire pour chauffer l'eau, puis encore E pour verser quand elle est chaude.",
          where2,
        );
      case 'vitrine':
        return view(i, 'Maintiens E sur la cloche à viennoiseries pour servir la part.', where2);
      case 'frigo':
        return view(i, 'Maintiens E sur le plan de travail du frigo pour préparer.', where2);
      default:
        return view(i, 'Maintiens E sur le poste pour préparer.', where2);
    }
  }
}

function placeWord(station: string): string {
  switch (station) {
    case 'groupe':
      return 'sous le groupe de la machine';
    case 'vapeur':
      return 'sous la buse vapeur';
    case 'bouilloire':
      return 'à côté de la bouilloire';
    case 'vitrine':
      return 'devant la cloche à viennoiseries';
    case 'frigo':
      return 'sur le plan de travail du frigo';
    default:
      return 'sur le poste';
  }
}

function onFirstSlot(content: Content, world: World, furniture: string): ObjectState | undefined {
  const placed = world.furniture.find((f) => f.id === furniture);
  if (placed === undefined) return undefined;
  for (const slot of furnitureType(content, placed).slots) {
    const o = objectOnSlot(world, furniture, slot.id);
    if (o !== undefined) return o;
  }
  return undefined;
}

/** Récipient dont toutes les étapes sont faites (il porte la recette finie). */
function finished(content: Content, world: World, object: number): boolean {
  const item = itemOf(world.service, object);
  if (item === undefined) return false;
  const recipe = recipeOf(content, item.recipe);
  return recipe !== undefined && item.step >= recipe.steps.length;
}
