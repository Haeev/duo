/**
 * Règles du service, chez l'hôte (cahier 4.5 à 4.8): postes et gestes, tickets, passe, vaisselle,
 * stock. Tous les postes du service sont « au clic » dans `postes.json`: le service mène lui-même
 * les maintiens (Agir tenu, lu dans les entrées du pas), les fenêtres et la qualité. Les durées se
 * comptent en pas depuis `startTick`, à la cadence de l'hôte: un maintien commencé et relâché
 * par l'invité traverse le réseau avec le même retard aux deux bouts, sa durée reste juste
 * (technique 5.6). Rien ne rate (CO-06): au pire, « Correct ».
 */
import type { Content } from '../donnees/charger';
import type { ObjectState, PlacedFurniture, PlayerIndex, World } from '../etat/monde';
import { localToWorld } from '../simulation/geometrie';
import {
  furnitureById,
  heldObject,
  objectById,
  objectOnSlot,
  objectsOnTray,
} from '../simulation/monde';
import type { SimContext } from '../simulation/systemes';
import type { GdStation, Placement, Recipe, RecipeStep, Vessel } from './donnees';
import type { Article, DishCount, Gesture, Item, Quality, ServiceState, Ticket } from './etat';

// ---------------------------------------------------------------- lectures communes

export const QUALITY_RANK: Readonly<Record<Quality, number>> = { parfait: 2, bien: 1, correct: 0 };

export function worst(a: Quality | null, b: Quality | null): Quality | null {
  if (a === null) return b;
  if (b === null) return a;
  return QUALITY_RANK[a] <= QUALITY_RANK[b] ? a : b;
}

const atLeast = (q: Quality, floor: Quality): Quality =>
  QUALITY_RANK[q] >= QUALITY_RANK[floor] ? q : floor;

export function secondsSince(world: World, tick: number, dt: number): number {
  return Math.max(0, (world.tick - tick) * dt);
}

function stationOfFurniture(content: Content, placed: PlacedFurniture | undefined): string | null {
  if (placed === undefined) return null;
  return content.furniture.get(placed.type)?.station ?? null;
}

/** Poste du jeu où se fait une étape du game designer. */
export function gameStation(content: Content, gd: GdStation): string {
  return content.service.settings.stationOf[gd] ?? gd;
}

/** Niveau d'un poste du game designer: meubles posés (moulin à dose) et achats (pichet). */
export function stationLevel(content: Content, world: World, gd: GdStation): 1 | 2 | 3 {
  let level = 1;
  for (const f of world.furniture) {
    const l = content.service.settings.levels[f.type];
    if (l?.station === gd) level = Math.max(level, l.level);
  }
  for (const e of world.service.equipment) {
    const [kind, station, n] = e.split(':');
    if (kind === 'niveau' && station === gd) level = Math.max(level, Number(n) || 1);
  }
  return level >= 3 ? 3 : level >= 2 ? 2 : 1;
}

const byLevel = (values: readonly [number, number, number], level: 1 | 2 | 3): number =>
  level === 1 ? values[0] : level === 2 ? values[1] : values[2];

export function recipeOf(content: Content, id: string): Recipe | undefined {
  return content.service.recipes.get(id);
}

export function itemOf(service: ServiceState, object: number): Item | undefined {
  return service.items.find((i) => i.object === object);
}

/** Recette connue: du départ, ou débloquée (achat, habitué). */
export function recipeKnown(content: Content, world: World, id: string): boolean {
  const r = recipeOf(content, id);
  if (r === undefined) return false;
  return r.unlock.kind === 'start' || world.service.unlocked.includes(id);
}

/** Un poste de chaque étape est posé dans le café (presse-agrumes, crêpière achetés). */
export function recipeEquipped(content: Content, world: World, recipe: Recipe): boolean {
  return recipe.steps.every((s) => {
    const station = gameStation(content, s.station);
    return world.furniture.some((f) => stationOfFurniture(content, f) === station);
  });
}

export function missingIngredient(content: Content, world: World, recipe: Recipe): string | null {
  for (const i of recipe.ingredients) {
    if ((world.service.stock[i.id] ?? 0) + 1e-9 < i.qty)
      return content.service.ingredients.get(i.id)?.label ?? i.id;
  }
  return null;
}

/** Recettes qu'on peut mettre à l'ardoise et servir maintenant (pour la clientèle). */
export function orderableRecipes(content: Content, world: World): Recipe[] {
  return [...content.service.recipes.values()].filter(
    (r) =>
      recipeKnown(content, world, r.id) &&
      recipeEquipped(content, world, r) &&
      missingIngredient(content, world, r) === null,
  );
}

/** Objets posés sur un emplacement, avec ceux d'un plateau qui y est posé. */
function objectsAt(world: World, furniture: string, slot: string): ObjectState[] {
  const o = objectOnSlot(world, furniture, slot);
  if (o === undefined) return [];
  return [o, ...objectsOnTray(world, o.id)];
}

function mainSlot(content: Content, placed: PlacedFurniture | undefined): string | null {
  const station = stationOfFurniture(content, placed);
  return station === null ? null : (content.stations.get(station)?.slot ?? null);
}

function vesselOf(content: Content, type: string): { vessel: Vessel; dirty: boolean } | undefined {
  return content.service.vesselOf.get(type);
}

function removeObject(world: World, id: number): void {
  const at = world.objects.findIndex((o) => o.id === id);
  if (at >= 0) world.objects.splice(at, 1);
  const item = world.service.items.findIndex((i) => i.object === id);
  if (item >= 0) world.service.items.splice(item, 1);
  // Un article dont le récipient part à la plonge est à refaire.
  for (const t of world.service.tickets)
    for (const a of t.articles) if (a.object === id) a.object = null;
}

/**
 * Sorte de vaisselle d'un objet qu'on peut laver: sale, propre (rangée), ou un article en trop
 * qu'on vide (rien ne reste coincé en main, CO-09 et C12).
 */
function washable(content: Content, world: World, object: ObjectState): Vessel | null {
  const v = vesselOf(content, object.type);
  if (v !== undefined) return v.vessel;
  const item = itemOf(world.service, object.id);
  const recipe = recipeOf(content, item?.recipe ?? object.type);
  return recipe?.vessel ?? null;
}

function freeTrayPlace(content: Content, world: World, tray: ObjectState): number | null {
  const places = content.objects.get(tray.type)?.tray?.places ?? 0;
  const used = new Set(
    objectsOnTray(world, tray.id).map((o) => (o.at.kind === 'tray' ? o.at.place : -1)),
  );
  for (let i = 0; i < places; i++) if (!used.has(i)) return i;
  return null;
}

// ---------------------------------------------------------------- installation

/** Meuble posé d'après sa place (`anchor`: meuble porteur, coordonnées locales), ou `null`. */
export function placeFurniture(world: World, p: Placement): PlacedFurniture | null {
  const { id, type, x, z, y, rotDeg } = p;
  if (p.anchor === null) return { id, type, x, z, y, rotDeg };
  const a = furnitureById(world, p.anchor);
  if (a === undefined) return null;
  const w = localToWorld(a.x, a.z, a.rotDeg, x, z);
  return { id, type, x: w.x, z: w.z, y: a.y + y, rotDeg: a.rotDeg + rotDeg };
}

/**
 * Premier pas: le matériel du service se pose sur le comptoir (groupes et buse de la machine,
 * bouilloire, cloche, rail, palette de livraison), la vaisselle et une première livraison
 * attendent. Une sauvegarde du squelette s'installe de même à sa reprise.
 */
export function installService(content: Content, world: World): void {
  const s = world.service;
  const settings = content.service.settings;
  for (const p of settings.installation) {
    if (furnitureById(world, p.id) !== undefined) continue;
    const placed = placeFurniture(world, p);
    if (placed !== null) world.furniture.push(placed);
  }
  s.clean = { ...settings.cleanAtStart };
  for (const i of content.service.ingredients.values())
    s.stock[i.id] = (s.stock[i.id] ?? 0) + i.cartonUnits * settings.startCartons;
  s.installed = true;
}

// ---------------------------------------------------------------- recettes et articles

interface Choice {
  readonly recipe: Recipe;
  readonly ticket: Ticket | null;
  readonly article: Article | null;
}

/** Tickets dans l'ordre où ce joueur les prend: les siens, puis ceux de personne, puis les autres. */
function ticketsFor(service: ServiceState, player: PlayerIndex): Ticket[] {
  const rank = (t: Ticket): number => (t.taker === player ? 0 : t.taker === null ? 1 : 2);
  return [...service.tickets].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

/**
 * Recette que commence ce récipient propre à ce poste: le premier article d'un ticket qui
 * commence ici (CO-03: n'importe qui peut aider), sinon la recette connue la plus simple du poste
 * (un article en trop reste « Prêt » sur le passe, CO-09).
 */
function chooseRecipe(
  content: Content,
  world: World,
  player: PlayerIndex,
  station: string,
  vessel: Vessel,
): Choice | string {
  let shortage: string | null = null;
  const fits = (r: Recipe | undefined): r is Recipe =>
    r?.vessel === vessel &&
    r.steps[0] !== undefined &&
    gameStation(content, r.steps[0].station) === station;
  // Un article qui passe ici plus tard (le lait d'un café crème): on dit par où commencer plutôt
  // que de lancer une autre recette.
  let elsewhere: string | null = null;
  for (const ticket of ticketsFor(world.service, player)) {
    for (const article of ticket.articles) {
      if (article.object !== null) continue;
      const recipe = recipeOf(content, article.recipe);
      const first = recipe?.steps[0];
      if (
        recipe?.vessel === vessel &&
        first !== undefined &&
        recipe.steps.some((st) => gameStation(content, st.station) === station)
      )
        elsewhere ??= content.stations.get(gameStation(content, first.station))?.label ?? null;
      if (!fits(recipe)) continue;
      const missing = missingIngredient(content, world, recipe);
      if (missing !== null) {
        shortage ??= missing;
        continue;
      }
      return { recipe, ticket, article };
    }
  }
  if (elsewhere !== null && shortage === null) return `D’abord : ${elsewhere}`;
  for (const recipe of content.service.recipes.values()) {
    if (!fits(recipe) || !recipeKnown(content, world, recipe.id)) continue;
    const missing = missingIngredient(content, world, recipe);
    if (missing !== null) {
      shortage ??= missing;
      continue;
    }
    return { recipe, ticket: null, article: null };
  }
  if (shortage !== null) return `Il manque : ${shortage}`;
  return 'Rien à préparer ici avec ça';
}

/** Ce que ferait le poste pour ce récipient: l'article en cours ou un nouveau. */
function planItem(
  content: Content,
  world: World,
  player: PlayerIndex,
  station: string,
  object: ObjectState,
): { readonly item: Item; readonly step: RecipeStep } | Choice | string {
  const item = itemOf(world.service, object.id);
  if (item !== undefined) {
    const recipe = recipeOf(content, item.recipe);
    const step = recipe?.steps[item.step];
    if (recipe === undefined) return 'Recette inconnue';
    if (step === undefined) return `${recipe.label} est prêt`;
    if (gameStation(content, step.station) !== station) {
      const next = content.stations.get(gameStation(content, step.station))?.label ?? step.station;
      return `Étape suivante : ${next}`;
    }
    return { item, step };
  }
  const v = vesselOf(content, object.type);
  if (v === undefined) return 'Rien à préparer avec ça';
  if (v.dirty) return 'À laver d’abord';
  return chooseRecipe(content, world, player, station, v.vessel);
}

/** Engage un récipient dans sa recette: matières et théière prises, l'article s'y attache. */
function commitItem(sim: SimContext, object: ObjectState, choice: Choice): Item | string {
  const { world } = sim;
  const s = world.service;
  const extra = choice.recipe.dishes - 1;
  if (extra > 0) {
    if (s.clean.tasse < extra) return 'Plus de tasse propre pour la théière';
    s.clean.tasse -= extra;
  }
  for (const i of choice.recipe.ingredients) s.stock[i.id] = (s.stock[i.id] ?? 0) - i.qty;
  const item: Item = {
    object: object.id,
    recipe: choice.recipe.id,
    ticket: choice.ticket?.id ?? null,
    step: 0,
    quality: null,
    art: null,
    steamed: false,
  };
  s.items.push(item);
  if (choice.article !== null) choice.article.object = object.id;
  return item;
}

function resolveItem(
  sim: SimContext,
  player: PlayerIndex,
  station: string,
  object: ObjectState,
): { item: Item; step: RecipeStep } | string {
  const plan = planItem(sim.content, sim.world, player, station, object);
  if (typeof plan === 'string') return plan;
  if ('item' in plan) return plan;
  const item = commitItem(sim, object, plan);
  if (typeof item === 'string') return item;
  const step = plan.recipe.steps[0];
  if (step === undefined) return 'Recette vide';
  return { item, step };
}

/** Une étape faite: qualité gardée (la plus faible), apparence du récipient, article prêt. */
function finishStep(
  sim: SimContext,
  player: PlayerIndex,
  item: Item,
  quality: Quality | null,
): void {
  const recipe = recipeOf(sim.content, item.recipe);
  const object = objectById(sim.world, item.object);
  if (recipe === undefined || object === undefined) return;
  const done = recipe.steps[item.step];
  item.quality = worst(item.quality, quality);
  item.step++;
  item.steamed = done?.station === 'vapeur';
  if (item.step >= recipe.steps.length) {
    object.type = recipe.id;
    sim.emit({
      type: 'service-item-ready',
      player,
      object: object.id,
      recipe: recipe.id,
      quality: item.quality,
    });
  } else if (done?.station === 'espresso') {
    object.type = sim.content.service.settings.afterEspresso;
  }
}

// ---------------------------------------------------------------- jugements

export function judgeExtraction(content: Content, elapsed: number, ready: number): Quality {
  const g = content.service.settings.gestures.extraction;
  if (elapsed < g.underSeconds) return 'correct';
  if (elapsed < ready) return 'bien';
  if (elapsed <= ready + g.perfectSeconds) return 'parfait';
  if (elapsed <= ready + g.goodSeconds) return 'bien';
  return 'correct';
}

export function judgeSteam(content: Content, temperatureC: number): Quality {
  const g = content.service.settings.gestures.steam;
  if (temperatureC >= g.perfectC[0] && temperatureC <= g.perfectC[1]) return 'parfait';
  if (temperatureC >= g.goodC[0] && temperatureC <= g.goodC[1]) return 'bien';
  return 'correct';
}

export function judgeTea(content: Content, temperatureC: number, targetC: number): Quality {
  const g = content.service.settings.gestures.kettle;
  const d = Math.abs(temperatureC - targetC);
  if (d <= g.perfectDeltaC) return 'parfait';
  if (d <= g.goodDeltaC) return 'bien';
  return 'correct';
}

/** Température de la bouilloire, ou `null` si elle est froide. */
export function kettleTemperature(
  content: Content,
  world: World,
  furniture: string,
  dt: number,
): number | null {
  const kettle = world.service.kettles.find((k) => k.furniture === furniture);
  if (kettle === undefined || kettle.startTick === null) return null;
  const g = content.service.settings.gestures.kettle;
  const t = g.startC + g.degreesPerSecond * secondsSince(world, kettle.startTick, dt);
  let max = g.maxC;
  // Bouilloire à température (niveau 2): elle s'arrête seule à l'eau du thé posé.
  if (stationLevel(content, world, 'bouilloire') >= 2) {
    const target = kettleTarget(content, world, furniture);
    if (target !== null) max = Math.min(max, target);
  }
  return Math.min(t, max);
}

function kettleTarget(content: Content, world: World, furniture: string): number | null {
  const placed = furnitureById(world, furniture);
  const slot = mainSlot(content, placed);
  const cup = slot === null ? undefined : objectOnSlot(world, furniture, slot);
  const item = cup === undefined ? undefined : itemOf(world.service, cup.id);
  const step = item === undefined ? undefined : recipeOf(content, item.recipe)?.steps[item.step];
  return step?.waterC ?? null;
}

export function steamTemperature(
  content: Content,
  world: World,
  gesture: Gesture,
  dt: number,
): number {
  const g = content.service.settings.gestures.steam;
  return g.startC + gesture.rate * secondsSince(world, gesture.startTick, dt);
}

// ---------------------------------------------------------------- vaisselle

/** Sorte de vaisselle qu'attend le prochain article à commencer pour ce joueur. */
export function nextVessel(content: Content, world: World, player: PlayerIndex): Vessel {
  for (const ticket of ticketsFor(world.service, player))
    for (const a of ticket.articles)
      if (a.object === null) {
        const r = recipeOf(content, a.recipe);
        if (r !== undefined) return r.vessel;
      }
  return 'tasse';
}

const VESSEL_LABEL: Readonly<Record<Vessel, string>> = {
  tasse: 'Plus de tasses propres',
  verre: 'Plus de verres propres',
  assiette: 'Plus d’assiettes propres',
};

function addDishes(count: DishCount, vessel: Vessel, n: number): void {
  count[vessel] += n;
}

// ---------------------------------------------------------------- postes

type Plan =
  | { readonly kind: 'refuse'; readonly reason: string }
  | { readonly kind: 'go'; readonly run: (sim: SimContext) => void };

const refuse = (reason: string): Plan => ({ kind: 'refuse', reason });

function gestureBusy(world: World, player: PlayerIndex, furniture: string): boolean {
  const other = world.service.gestures[player === 0 ? 1 : 0];
  return other !== null && other.furniture === furniture;
}

function startGesture(sim: SimContext, player: PlayerIndex, g: Omit<Gesture, 'startTick'>): void {
  sim.world.service.gestures[player] = { ...g, startTick: sim.world.tick };
}

function assisted(world: World, player: PlayerIndex): boolean {
  return world.service.assist[player];
}

/** Le récipient posé sur l'emplacement principal du poste. */
function vesselOnStation(sim: SimContext, furniture: string): ObjectState | undefined {
  const slot = mainSlot(sim.content, furnitureById(sim.world, furniture));
  return slot === null ? undefined : objectOnSlot(sim.world, furniture, slot);
}

function planGroup(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  const s = sim.world.service;
  const running = s.processes.find((p) => p.furniture === furniture && p.kind === 'extraction');
  if (running !== undefined)
    return {
      kind: 'go',
      run: (x) => {
        stopProcess(x, running.object, null);
      },
    };
  if (s.groupsOut.includes(furniture)) return refuse('Ce groupe ne donne plus qu’un filet');
  const cup = vesselOnStation(sim, furniture);
  if (cup === undefined) return refuse('Pose d’abord une tasse');
  const plan = planItem(sim.content, sim.world, player, 'groupe', cup);
  if (typeof plan === 'string') return refuse(plan);
  if (s.doses <= 0) return refuse('Moud d’abord une dose');
  return {
    kind: 'go',
    run: (x) => {
      const r = resolveItem(x, player, 'groupe', cup);
      if (typeof r === 'string') {
        x.emit({ type: 'refused', player, reason: r });
        return;
      }
      const level = stationLevel(x.content, x.world, 'espresso');
      x.world.service.doses--;
      x.world.service.processes.push({
        kind: 'extraction',
        furniture,
        object: cup.id,
        player,
        startTick: x.world.tick,
        readySeconds: byLevel(r.step.passiveSeconds, level),
      });
      x.emit({ type: 'service-extraction-start', player, furniture });
    },
  };
}

/** Fin d'une extraction ou d'une cuisson: jugée sur le temps écoulé, ou par l'aide. */
function stopProcess(sim: SimContext, object: number, forced: Quality | null): void {
  const s = sim.world.service;
  const at = s.processes.findIndex((p) => p.object === object);
  const p = s.processes[at];
  if (p === undefined) return;
  s.processes.splice(at, 1);
  const item = itemOf(s, object);
  if (item === undefined) return;
  const elapsed = secondsSince(sim.world, p.startTick, sim.dt);
  if (p.kind === 'extraction') {
    const q = forced ?? judgeExtraction(sim.content, elapsed, p.readySeconds);
    finishStep(sim, p.player, item, q);
    sim.emit({
      type: 'service-extraction-stop',
      player: p.player,
      furniture: p.furniture,
      quality: q,
    });
  } else {
    const g = sim.content.service.settings.gestures.cook;
    const q =
      forced ??
      (elapsed >= p.readySeconds && elapsed <= p.readySeconds + g.goldenSeconds
        ? 'parfait'
        : 'correct');
    finishStep(sim, p.player, item, q);
    sim.emit({ type: 'service-cook-done', player: p.player, furniture: p.furniture, quality: q });
  }
}

function planSteam(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  if (gestureBusy(sim.world, player, furniture)) return refuse('La buse est prise');
  const cup = vesselOnStation(sim, furniture);
  if (cup === undefined) return refuse('Pose d’abord une tasse');
  const plan = planItem(sim.content, sim.world, player, 'vapeur', cup);
  if (typeof plan === 'string') return refuse(plan);
  return {
    kind: 'go',
    run: (x) => {
      const r = resolveItem(x, player, 'vapeur', cup);
      if (typeof r === 'string') {
        x.emit({ type: 'refused', player, reason: r });
        return;
      }
      const g = x.content.service.settings.gestures.steam;
      const active = Math.max(
        0.5,
        byLevel(r.step.activeSeconds, stationLevel(x.content, x.world, 'vapeur')),
      );
      startGesture(x, player, {
        kind: 'steam',
        action: 'steam',
        furniture,
        object: cup.id,
        seconds: 0,
        rate: (g.assistC - g.startC) / active,
      });
      x.emit({ type: 'service-steam-start', player, furniture });
    },
  };
}

/** Postes à maintien sans jugement (cloche, plan et frigo, presse), et la crêpière. */
function planPrep(sim: SimContext, player: PlayerIndex, furniture: string, station: string): Plan {
  if (gestureBusy(sim.world, player, furniture)) return refuse('Poste occupé');
  const object = vesselOnStation(sim, furniture);
  if (object === undefined) return refuse('Pose d’abord le récipient');
  const carton = sim.world.service.cartons.find((c) => c.object === object.id);
  if (carton !== undefined) return planStore(sim, player, furniture);
  if (station === 'crepiere') {
    const cooking = sim.world.service.processes.find((p) => p.furniture === furniture);
    if (cooking !== undefined) {
      if (secondsSince(sim.world, cooking.startTick, sim.dt) < cooking.readySeconds)
        return refuse('Pas encore dorée');
      return {
        kind: 'go',
        run: (x) => {
          stopProcess(x, cooking.object, null);
        },
      };
    }
  }
  const plan = planItem(sim.content, sim.world, player, station, object);
  if (typeof plan === 'string') return refuse(plan);
  return {
    kind: 'go',
    run: (x) => {
      const r = resolveItem(x, player, station, object);
      if (typeof r === 'string') {
        x.emit({ type: 'refused', player, reason: r });
        return;
      }
      const level = stationLevel(x.content, x.world, r.step.station);
      startGesture(x, player, {
        kind: 'hold',
        action: station === 'crepiere' ? 'cook-start' : 'prep',
        furniture,
        object: object.id,
        seconds: assisted(x.world, player) ? 0 : byLevel(r.step.activeSeconds, level),
        rate: 0,
      });
    },
  };
}

function planKettle(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  const cup = vesselOnStation(sim, furniture);
  if (cup === undefined) return refuse('Pose d’abord une tasse');
  const plan = planItem(sim.content, sim.world, player, 'bouilloire', cup);
  if (typeof plan === 'string') return refuse(plan);
  const temperature = kettleTemperature(sim.content, sim.world, furniture, sim.dt);
  if (temperature === null)
    return {
      kind: 'go',
      run: (x) => {
        const r = resolveItem(x, player, 'bouilloire', cup);
        if (typeof r === 'string') {
          x.emit({ type: 'refused', player, reason: r });
          return;
        }
        const kettles = x.world.service.kettles;
        const k = kettles.find((c) => c.furniture === furniture);
        if (k === undefined) kettles.push({ furniture, startTick: x.world.tick, player });
        else {
          k.startTick = x.world.tick;
          k.player = player;
        }
        x.emit({ type: 'service-kettle-start', player, furniture });
      },
    };
  if (temperature < 60) return refuse('L’eau chauffe encore');
  return {
    kind: 'go',
    run: (x) => {
      const r = resolveItem(x, player, 'bouilloire', cup);
      if (typeof r === 'string') {
        x.emit({ type: 'refused', player, reason: r });
        return;
      }
      const target = r.step.waterC ?? 95;
      let q = judgeTea(x.content, temperature, target);
      if (assisted(x.world, player)) q = atLeast(q, 'bien');
      const k = x.world.service.kettles.find((c) => c.furniture === furniture);
      if (k !== undefined) k.startTick = null;
      finishStep(x, player, r.item, q);
      x.emit({ type: 'service-tea-poured', player, furniture, quality: q });
    },
  };
}

function planGrind(sim: SimContext, player: PlayerIndex, furniture: string, dose: boolean): Plan {
  const g = sim.content.service.settings.gestures.grind;
  const s = sim.world.service;
  if (s.doses >= g.maxDoses) return refuse('Les porte-filtres sont garnis');
  if (gestureBusy(sim.world, player, furniture)) return refuse('Moulin occupé');
  if ((s.stock['grains-maison'] ?? 1) <= 0) return refuse('Plus de grains');
  if (dose)
    return {
      kind: 'go',
      run: (x) => {
        x.world.service.doses = Math.min(g.maxDoses, x.world.service.doses + g.dosesPerClick);
        x.emit({ type: 'service-dose', player, furniture, doses: x.world.service.doses });
      },
    };
  return {
    kind: 'go',
    run: (x) => {
      startGesture(x, player, {
        kind: 'hold',
        action: 'grind',
        furniture,
        object: null,
        seconds: assisted(x.world, player) ? 0 : g.holdSeconds,
        rate: 0,
      });
      x.emit({ type: 'service-grind-start', player, furniture });
    },
  };
}

function planOrder(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  const order = sim.world.service.waiting[0];
  if (order === undefined) return refuse('Personne à la caisse');
  if (gestureBusy(sim.world, player, furniture)) return refuse('La caisse est prise');
  const g = sim.content.service.settings.gestures.order;
  return {
    kind: 'go',
    run: (x) => {
      startGesture(x, player, {
        kind: 'hold',
        action: 'order',
        furniture,
        object: null,
        seconds: g.seconds + g.perExtraArticle * Math.max(0, order.articles.length - 1),
        rate: 0,
      });
    },
  };
}

function planDishes(sim: SimContext, player: PlayerIndex): Plan {
  const { content, world } = sim;
  const held = heldObject(world, player);
  const tray =
    held !== undefined && (content.objects.get(held.type)?.tray ?? null) !== null
      ? held
      : undefined;
  if (held !== undefined && tray === undefined) return refuse('Tes mains sont prises');
  const place = tray === undefined ? 0 : freeTrayPlace(content, world, tray);
  if (place === null) return refuse('Plateau plein');
  const vessel = nextVessel(content, world, player);
  if (world.service.clean[vessel] <= 0) return refuse(VESSEL_LABEL[vessel]);
  return {
    kind: 'go',
    run: (x) => {
      const s = x.world.service;
      const id = x.world.nextObjectId++;
      const type = x.content.service.settings.vessels[vessel].clean;
      x.world.objects.push({
        id,
        type,
        at: tray === undefined ? { kind: 'hand', player } : { kind: 'tray', tray: tray.id, place },
      });
      s.clean[vessel]--;
      x.emit({ type: 'taken', player, object: id, objectType: type });
      if (s.clean[vessel] === 0) x.emit({ type: 'service-dishes-out', vessel });
    },
  };
}

/** Ce qui se lave sur un emplacement (objet, ou ce que porte un plateau, pas le plateau). */
function dirtyAt(sim: SimContext, furniture: string, slot: string): ObjectState[] {
  return objectsAt(sim.world, furniture, slot).filter(
    (o) => washable(sim.content, sim.world, o) !== null,
  );
}

function backlogTotal(s: ServiceState): number {
  return s.dirtyBacklog.tasse + s.dirtyBacklog.verre + s.dirtyBacklog.assiette;
}

function planWash(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  if (gestureBusy(sim.world, player, furniture)) return refuse('Quelqu’un lave déjà');
  const slot = mainSlot(sim.content, furnitureById(sim.world, furniture)) ?? '';
  if (dirtyAt(sim, furniture, slot).length === 0 && backlogTotal(sim.world.service) === 0)
    return refuse('Rien à laver');
  return {
    kind: 'go',
    run: (x) => {
      startGesture(x, player, {
        kind: 'hold',
        action: 'wash',
        furniture,
        object: null,
        seconds: x.content.service.settings.gestures.wash.secondsPerPiece,
        rate: 0,
      });
    },
  };
}

/** Lave une pièce: d'abord ce qui est posé dans le bac, puis la vaisselle rapportée. */
function washOne(sim: SimContext, player: PlayerIndex, furniture: string): boolean {
  const s = sim.world.service;
  const slot = mainSlot(sim.content, furnitureById(sim.world, furniture)) ?? '';
  const dirty = dirtyAt(sim, furniture, slot);
  const first = dirty[dirty.length - 1];
  let vessel: Vessel | null = null;
  if (first !== undefined) {
    vessel = washable(sim.content, sim.world, first);
    removeObject(sim.world, first.id);
  } else {
    for (const k of ['tasse', 'verre', 'assiette'] as const)
      if (vessel === null && s.dirtyBacklog[k] > 0) {
        s.dirtyBacklog[k]--;
        vessel = k;
      }
  }
  if (vessel === null) return false;
  addDishes(s.clean, vessel, 1);
  sim.emit({ type: 'service-washed', player, vessel });
  return dirtyAt(sim, furniture, slot).length > 0 || backlogTotal(s) > 0;
}

function planDishwasher(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  const s = sim.world.service;
  const g = sim.content.service.settings.gestures.dishwasher;
  const machine = s.dishwashers.find((d) => d.furniture === furniture) ?? {
    furniture,
    loaded: { tasse: 0, verre: 0, assiette: 0 },
    startTick: null,
    done: false,
  };
  if (machine.startTick !== null) return refuse('Le cycle tourne encore');
  const ensure = (x: SimContext): typeof machine => {
    const list = x.world.service.dishwashers;
    const found = list.find((d) => d.furniture === furniture);
    if (found !== undefined) return found;
    list.push(machine);
    return machine;
  };
  const pieces = machine.loaded.tasse + machine.loaded.verre + machine.loaded.assiette;
  if (machine.done)
    return {
      kind: 'go',
      run: (x) => {
        const m = ensure(x);
        for (const k of ['tasse', 'verre', 'assiette'] as const)
          addDishes(x.world.service.clean, k, m.loaded[k]);
        m.loaded = { tasse: 0, verre: 0, assiette: 0 };
        m.done = false;
        x.emit({ type: 'service-dishwasher-emptied', player, furniture, pieces });
      },
    };
  const slot = mainSlot(sim.content, furnitureById(sim.world, furniture)) ?? '';
  const dirty = dirtyAt(sim, furniture, slot);
  const room = g.capacity - pieces;
  // Panier garni: on charge (avec la vaisselle rapportée); panier vide: on lance s'il y a de
  // quoi, sinon on charge la vaisselle rapportée.
  const load = room > 0 && (dirty.length > 0 || (pieces === 0 && backlogTotal(s) > 0));
  if (load)
    return {
      kind: 'go',
      run: (x) => {
        const m = ensure(x);
        let free = room;
        for (const o of dirty) {
          const v = washable(x.content, x.world, o);
          if (v === null || free <= 0) continue;
          m.loaded[v]++;
          free--;
          removeObject(x.world, o.id);
        }
        for (const k of ['tasse', 'verre', 'assiette'] as const) {
          const n = Math.min(free, x.world.service.dirtyBacklog[k]);
          x.world.service.dirtyBacklog[k] -= n;
          m.loaded[k] += n;
          free -= n;
        }
      },
    };
  if (pieces === 0) return refuse('Pose la vaisselle sale sur le panier');
  return {
    kind: 'go',
    run: (x) => {
      const m = ensure(x);
      m.startTick = x.world.tick;
      x.emit({ type: 'service-dishwasher-start', player, furniture, pieces });
    },
  };
}

function planRail(sim: SimContext, player: PlayerIndex): Plan {
  const next = sim.world.service.tickets.find((t) => t.taker === null);
  if (next === undefined) return refuse('Aucun ticket à prendre');
  return {
    kind: 'go',
    run: (x) => {
      const t = x.world.service.tickets.find((u) => u.id === next.id);
      if (t === undefined) return;
      t.taker = player;
      x.emit({ type: 'service-ticket-taken', player, ticket: t.id });
    },
  };
}

const STORAGE_LABEL = {
  frigo: 'Au réfrigérateur de la réserve',
  reserve: 'Sur une étagère de la réserve',
  vitrine: 'Dans la cloche du comptoir',
} as const;

function planStore(sim: SimContext, player: PlayerIndex, furniture: string): Plan {
  const placed = furnitureById(sim.world, furniture);
  const object = vesselOnStation(sim, furniture);
  const carton =
    object === undefined
      ? undefined
      : sim.world.service.cartons.find((c) => c.object === object.id);
  if (placed === undefined || object === undefined || carton === undefined)
    return refuse('Pose d’abord le carton');
  const ingredient = sim.content.service.ingredients.get(carton.ingredient);
  if (ingredient === undefined) return refuse('Carton inconnu');
  if (!sim.content.service.settings.storage[ingredient.storage].includes(placed.type))
    return refuse(STORAGE_LABEL[ingredient.storage]);
  return {
    kind: 'go',
    run: (x) => {
      const s = x.world.service;
      s.stock[carton.ingredient] = (s.stock[carton.ingredient] ?? 0) + carton.units;
      s.cartons = s.cartons.filter((c) => c.object !== carton.object);
      removeObject(x.world, carton.object);
      x.emit({
        type: 'service-carton-stored',
        player,
        ingredient: carton.ingredient,
        units: carton.units,
      });
    },
  };
}

/** Ce que fait « Agir » sur un poste du service. */
export function planStation(
  sim: SimContext,
  player: PlayerIndex,
  furniture: string,
  station: string,
): Plan {
  switch (station) {
    case 'groupe':
      return planGroup(sim, player, furniture);
    case 'vapeur':
      return planSteam(sim, player, furniture);
    case 'moulin':
      return planGrind(sim, player, furniture, false);
    case 'moulin-dose':
      return planGrind(sim, player, furniture, true);
    case 'caisse':
      return planOrder(sim, player, furniture);
    case 'frigo':
    case 'vitrine':
    case 'presse-agrumes':
    case 'crepiere':
      return planPrep(sim, player, furniture, station);
    case 'bouilloire':
      return planKettle(sim, player, furniture);
    case 'vaisselle':
      return planDishes(sim, player);
    case 'plonge':
      return planWash(sim, player, furniture);
    case 'lave-vaisselle':
      return planDishwasher(sim, player, furniture);
    case 'rail':
      return planRail(sim, player);
    case 'rangement':
      return planStore(sim, player, furniture);
    default:
      return refuse('Rien à faire ici');
  }
}

export const SERVICE_STATIONS = [
  'groupe',
  'vapeur',
  'moulin',
  'moulin-dose',
  'caisse',
  'frigo',
  'vitrine',
  'presse-agrumes',
  'crepiere',
  'bouilloire',
  'vaisselle',
  'plonge',
  'lave-vaisselle',
  'rail',
  'rangement',
] as const;

// ---------------------------------------------------------------- commandes et tickets

/** Crée le ticket d'une commande prise; un article en trop déjà prêt s'y attache (CO-09). */
export function openTicket(
  sim: SimContext,
  customer: string | null,
  articles: readonly Article[],
  player: PlayerIndex | null,
): Ticket {
  const s = sim.world.service;
  const ticket: Ticket = {
    id: s.nextTicketId++,
    customer,
    articles: articles.map((a) => ({ ...a, options: [...a.options] })),
    taker: null,
    createdTick: sim.world.tick,
    status: 'open',
    total: Math.round(articles.reduce((sum, a) => sum + a.price, 0) * 100) / 100,
  };
  for (const a of ticket.articles) {
    const spare = s.items
      .filter((i) => i.ticket === null && i.recipe === a.recipe)
      .sort((x, y) => y.step - x.step)[0];
    if (spare !== undefined) {
      spare.ticket = ticket.id;
      a.object = spare.object;
    }
  }
  s.tickets.push(ticket);
  s.receipts.push({ ticket: ticket.id, customer, amount: ticket.total });
  if (player !== null)
    sim.emit({ type: 'service-order-taken', player, ticket: ticket.id, customer });
  sim.emit({ type: 'service-paid', ticket: ticket.id, amount: ticket.total });
  return ticket;
}

function onPasse(content: Content, world: World, object: ObjectState, depth = 0): boolean {
  const at = object.at;
  if (at.kind === 'slot') {
    const placed = furnitureById(world, at.furniture);
    return placed !== undefined && content.service.settings.passe.includes(placed.type);
  }
  if (at.kind === 'tray' && depth < 2) {
    const tray = objectById(world, at.tray);
    return tray !== undefined && onPasse(content, world, tray, depth + 1);
  }
  return false;
}

/** Un ticket est prêt quand chacun de ses articles est fini et posé sur le passe (CO-03). */
export function ticketReady(content: Content, world: World, ticket: Ticket): boolean {
  return ticket.articles.every((a) => {
    if (a.object === null) return false;
    const item = itemOf(world.service, a.object);
    const recipe = item === undefined ? undefined : recipeOf(content, item.recipe);
    const object = objectById(world, a.object);
    return (
      item !== undefined &&
      recipe !== undefined &&
      object !== undefined &&
      item.step >= recipe.steps.length &&
      onPasse(content, world, object)
    );
  });
}

// ---------------------------------------------------------------- pas de l'hôte

function finishGesture(sim: SimContext, player: PlayerIndex, g: Gesture): void {
  const s = sim.world.service;
  s.gestures[player] = null;
  switch (g.action) {
    case 'grind': {
      const max = sim.content.service.settings.gestures.grind.maxDoses;
      s.doses = Math.min(max, s.doses + 1);
      sim.emit({ type: 'service-dose', player, furniture: g.furniture, doses: s.doses });
      return;
    }
    case 'order': {
      const order = s.waiting.shift();
      if (order !== undefined) openTicket(sim, order.customer, order.articles, player);
      return;
    }
    case 'wash': {
      const more = washOne(sim, player, g.furniture);
      // Agir toujours tenu: la pièce suivante (PL-02, 1,5 s par pièce).
      if (more && sim.inputs[player].actHeld)
        s.gestures[player] = { ...g, startTick: sim.world.tick };
      return;
    }
    case 'prep':
    case 'cook-start': {
      const item = g.object === null ? undefined : itemOf(s, g.object);
      if (item === undefined) return;
      const recipe = recipeOf(sim.content, item.recipe);
      const step = recipe?.steps[item.step];
      if (recipe === undefined || step === undefined) return;
      if (g.action === 'prep') {
        finishStep(sim, player, item, null);
        sim.emit({ type: 'service-prep-done', player, furniture: g.furniture, recipe: recipe.id });
        return;
      }
      const level = stationLevel(sim.content, sim.world, step.station);
      s.processes.push({
        kind: 'cook',
        furniture: g.furniture,
        object: item.object,
        player,
        startTick: sim.world.tick,
        readySeconds: byLevel(step.passiveSeconds, level),
      });
      sim.emit({ type: 'service-cook-start', player, furniture: g.furniture });
      return;
    }
    case 'steam':
      return;
  }
}

function endSteam(
  sim: SimContext,
  player: PlayerIndex,
  g: Gesture,
  quality: Quality | null,
  t: number,
): void {
  sim.world.service.gestures[player] = null;
  if (quality === null) return;
  const item = g.object === null ? undefined : itemOf(sim.world.service, g.object);
  if (item !== undefined) finishStep(sim, player, item, quality);
  sim.emit({
    type: 'service-steam-stop',
    player,
    furniture: g.furniture,
    quality,
    temperatureC: Math.round(t),
  });
}

/** L'objet du geste a quitté son poste (pris par l'autre): le geste s'arrête, rien n'est perdu. */
function gestureObjectGone(sim: SimContext, g: Gesture): boolean {
  if (g.object === null) return false;
  const o = objectById(sim.world, g.object);
  return o?.at.kind !== 'slot' || o.at.furniture !== g.furniture;
}

function stepGestures(sim: SimContext): void {
  const s = sim.world.service;
  for (const player of [0, 1] as const) {
    const g = s.gestures[player];
    if (g === null) continue;
    if (gestureObjectGone(sim, g)) {
      s.gestures[player] = null;
      continue;
    }
    const held = sim.inputs[player].actHeld;
    if (g.kind === 'steam') {
      const st = sim.content.service.settings.gestures.steam;
      const t = steamTemperature(sim.content, sim.world, g, sim.dt);
      if (assisted(sim.world, player)) {
        if (t >= st.assistC) endSteam(sim, player, g, 'bien', t);
      } else if (t >= st.cutC) endSteam(sim, player, g, 'correct', t);
      else if (!held) endSteam(sim, player, g, t < st.minC ? null : judgeSteam(sim.content, t), t);
      continue;
    }
    const elapsed = secondsSince(sim.world, g.startTick, sim.dt);
    if (elapsed + 1e-9 >= g.seconds) finishGesture(sim, player, g);
    else if (!held) s.gestures[player] = null;
  }
}

function stepProcesses(sim: SimContext): void {
  const s = sim.world.service;
  const ex = sim.content.service.settings.gestures.extraction;
  const cook = sim.content.service.settings.gestures.cook;
  for (const p of [...s.processes]) {
    const object = objectById(sim.world, p.object);
    if (object?.at.kind !== 'slot' || object.at.furniture !== p.furniture) {
      // Tasse retirée pendant l'extraction: la dose revient, la tasse garde son étape.
      s.processes = s.processes.filter((q) => q !== p);
      if (p.kind === 'extraction') s.doses++;
      continue;
    }
    const elapsed = secondsSince(sim.world, p.startTick, sim.dt);
    const help = assisted(sim.world, p.player);
    if (p.kind === 'extraction') {
      if (help && elapsed >= p.readySeconds + ex.assistStopAfterSeconds)
        stopProcess(sim, p.object, 'bien');
      else if (elapsed >= ex.autoStopSeconds) stopProcess(sim, p.object, 'correct');
    } else if (help && elapsed >= p.readySeconds) stopProcess(sim, p.object, 'bien');
    else if (elapsed >= p.readySeconds + cook.autoStopSeconds)
      stopProcess(sim, p.object, 'correct');
  }
}

function stepKettles(sim: SimContext): void {
  const g = sim.content.service.settings.gestures.kettle;
  for (const k of sim.world.service.kettles) {
    if (k.startTick === null) continue;
    // Le déclic, une fois, au pas où l'eau atteint son maximum.
    const now = g.startC + g.degreesPerSecond * secondsSince(sim.world, k.startTick, sim.dt);
    const before = now - g.degreesPerSecond * sim.dt;
    const max = kettleTemperature(sim.content, sim.world, k.furniture, sim.dt) ?? g.maxC;
    if (now >= max && before < max)
      sim.emit({ type: 'service-kettle-hot', furniture: k.furniture });
  }
}

function stepDishwashers(sim: SimContext): void {
  const cycle = sim.content.service.settings.gestures.dishwasher.cycleSeconds;
  for (const d of sim.world.service.dishwashers) {
    if (d.startTick === null) continue;
    if (secondsSince(sim.world, d.startTick, sim.dt) >= cycle) {
      d.startTick = null;
      d.done = true;
      sim.emit({ type: 'service-dishwasher-done', furniture: d.furniture });
    }
  }
}

function stepTickets(sim: SimContext): void {
  for (const t of sim.world.service.tickets) {
    const ready = ticketReady(sim.content, sim.world, t);
    if (ready && t.status === 'open') {
      t.status = 'ready';
      sim.emit({ type: 'service-ticket-ready', ticket: t.id, customer: t.customer });
    } else if (!ready && t.status === 'ready') t.status = 'open';
  }
}

/** Un objet posé sur la pince du rail glisse sur le passe: rien ne reste suspendu. */
function stepRail(sim: SimContext): void {
  const { content, world } = sim;
  for (const o of world.objects) {
    if (o.at.kind !== 'slot') continue;
    const placed = furnitureById(world, o.at.furniture);
    if (stationOfFurniture(content, placed) !== 'rail') continue;
    for (const f of world.furniture) {
      if (!content.service.settings.passe.includes(f.type)) continue;
      const free = content.furniture
        .get(f.type)
        ?.slots.find((sl) => objectOnSlot(world, f.id, sl.id) === undefined);
      if (free !== undefined) {
        o.at = { kind: 'slot', furniture: f.id, slot: free.id };
        break;
      }
    }
  }
}

/** Avancement d'un geste, de 0 à 1 (buse: la température vers la coupure). */
export function gestureProgress(content: Content, world: World, g: Gesture, dt: number): number {
  if (g.kind === 'steam') {
    const st = content.service.settings.gestures.steam;
    const t = steamTemperature(content, world, g, dt);
    return Math.min(1, Math.max(0, (t - st.startC) / (st.cutC - st.startC)));
  }
  return g.seconds <= 0 ? 1 : Math.min(1, secondsSince(world, g.startTick, dt) / g.seconds);
}

/**
 * L'anneau de maintien du HUD lit `players[].use` (temps écoulé sur `seconds` du poste): le
 * service y recopie l'avancement de son geste. Il sert aussi au cœur à dire « Poste occupé »
 * à l'autre joueur. `seconds` des postes du service est assez grand pour que le cœur ne
 * termine jamais lui-même le maintien.
 */
function syncUse(sim: SimContext): void {
  const { content, world, dt } = sim;
  const s = world.service;
  for (const player of [0, 1] as const) {
    const state = world.players[player];
    // Ce que suit l'anneau: le geste tenu, sinon l'extraction ou la crêpe lancée par ce joueur
    // (prête vers 60 % de l'anneau), sinon la bouilloire qu'il a mise à chauffer.
    let shown: { furniture: string; progress: number } | null = null;
    const g = s.gestures[player];
    const p = s.processes.filter((q) => q.player === player).at(-1);
    const kettle = s.kettles.find((k) => k.player === player && k.startTick !== null);
    if (g !== null)
      shown = { furniture: g.furniture, progress: gestureProgress(content, world, g, dt) };
    else if (p !== undefined) {
      const end =
        p.kind === 'extraction'
          ? content.service.settings.gestures.extraction.autoStopSeconds
          : p.readySeconds + content.service.settings.gestures.cook.autoStopSeconds;
      shown = { furniture: p.furniture, progress: secondsSince(world, p.startTick, dt) / end };
    } else if (kettle !== undefined) {
      const k = content.service.settings.gestures.kettle;
      const t = kettleTemperature(content, world, kettle.furniture, dt) ?? k.startC;
      shown = { furniture: kettle.furniture, progress: (t - k.startC) / (k.maxC - k.startC) };
    }
    if (shown === null) {
      const station = stationOfFurniture(content, furnitureById(world, state.use?.furniture ?? ''));
      if (station !== null && (SERVICE_STATIONS as readonly string[]).includes(station))
        state.use = null;
      continue;
    }
    const station = stationOfFurniture(content, furnitureById(world, shown.furniture));
    const scale = station === null ? 0 : (content.stations.get(station)?.seconds ?? 0);
    // Par pas de 2 %: l'usage part à l'invité quand il change (canal 2), pas à chaque image.
    const progress = Math.round(Math.min(1, Math.max(0, shown.progress)) * 50) / 50;
    state.use = {
      furniture: shown.furniture,
      elapsed: progress * scale * 0.999,
    };
  }
}

export function stepService(sim: SimContext): void {
  if (!sim.world.service.installed) installService(sim.content, sim.world);
  stepGestures(sim);
  stepProcesses(sim);
  stepKettles(sim);
  stepDishwashers(sim);
  stepTickets(sim);
  stepRail(sim);
  syncUse(sim);
}
