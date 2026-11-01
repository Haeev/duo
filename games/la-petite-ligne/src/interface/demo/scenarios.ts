/**
 * Situations de la page de démonstration de l'interface (`?scenario=...`):
 * le robot de la simulation joue jusqu'au moment voulu, puis quelques
 * retouches de l'état montrent l'écran demandé. Outil de développement et
 * de captures seulement: le jeu ne passe jamais par ici.
 */
import type { Intent } from '../../etat/actions';
import { freezeState, momentDef } from '../../etat/moments';
import type { CharacterId, ItemStack, MomentMemoryEntry, MomentToday } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { newToday } from '../../simulation/moments';
import { step } from '../../simulation/pas';
import { createRobot } from '../../simulation/robot';
import { benchById, seatPlace } from '../../etat/bancs';

const HOUR = 60;
const MAX_TICKS = 400_000;

/** Fait jouer le robot (les deux personnages) jusqu'à ce que `until` soit vrai. */
export function playUntil(sim: Sim, until: (s: Sim) => boolean): void {
  const robot = createRobot();
  let ticks = 0;
  while (!until(sim) && ticks < MAX_TICKS) {
    step(sim, robot.decide(sim));
    ticks++;
  }
}

function at(sim: Sim, day: number, minutes: number): boolean {
  return sim.world.clock.day > day || (sim.world.clock.day === day && sim.world.clock.minutes >= minutes && sim.world.phase === 'day');
}

function character(sim: Sim, id: CharacterId): Sim['world']['characters'][number] {
  const c = sim.world.characters.find((x) => x.id === id);
  if (c === undefined) throw new Error(`personnage ${id}`);
  return c;
}

function apply(sim: Sim, by: CharacterId, intents: readonly Intent[]): void {
  step(sim, { controls: {}, intents: intents.map((intent) => ({ by, intent })) });
}

function stack(item: string, count: number, quality: ItemStack['quality'] = 'ordinary'): ItemStack {
  return { item, quality, count };
}

/** Un sac bien rempli, comme au milieu de la semaine (maquette du carnet). */
function fillBag(sim: Sim, id: CharacterId): void {
  const c = character(sim, id);
  const items: (ItemStack | null)[] = [
    stack('hoe', 1),
    stack('watering_can', 1),
    stack('axe', 1),
    stack('radish_seed', 8),
    stack('lettuce_seed', 4),
    stack('radish', 6, 'fine'),
    stack('plank', 4),
    stack('egg', 3),
    stack('bread', 1),
    null,
    stack('radish', 5),
    stack('carrot', 3),
    stack('carrot_seed', 4),
    stack('nail', 2),
    stack('log', 1),
    stack('riddle_card', 1),
  ];
  c.bag = c.bag.map((_, i) => items[i] ?? null);
  c.selected = 1;
  c.water = 7;
}

function teleport(sim: Sim, id: CharacterId, x: number, y: number): void {
  const c = character(sim, id);
  c.pos = { x, y };
  c.prev = { x, y };
  c.destination = null;
}

function near(sim: Sim, id: CharacterId, point: string, dx = 0.9, dy = 0.4): void {
  const p = sim.map.points[point];
  if (p !== undefined) teleport(sim, id, p.x + dx, p.y + dy);
}

// ---------------------------------------------------------------------------
// Tour 6: moments rares et informations propres. Les rôles ne dépendent pas de la page: avec la
// graine de la démo, p1 est l'informé des poules, p2 celui du mot de Lucie; `joueur=p1` et
// `joueur=p2` montrent les deux écrans d'une même situation.

/** Quelques pas sans entrée (personne ne bouge): la simulation recalcule ce que chacun remplit. */
function idle(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(sim, { controls: {}, intents: [] });
}

/** Les robots vont voir le héron du jour 6 et regardent ensemble, l'anneau à moitié. */
function heronTogether(sim: Sim): void {
  playUntil(sim, (s) => s.world.moments.today?.id === 'heron' && s.world.moments.today.phase === 'waiting' && s.world.moments.today.watchTicks >= 50);
}

/** Les poules à nommer: Odette s'est confiée à l'informé (p1), personne n'a encore appelé. */
function hensToName(sim: Sim): void {
  playUntil(sim, (s) => {
    const entry = s.world.secrets.entries.find((e) => e.quest === 'hen_names');
    return entry?.revealed === true && s.world.phase === 'day' && s.world.characters.every((c) => c.dialogue === null && c.menu === null);
  });
}

/** L'autre (p2) près de la première poule sans nom, la conversation « Comment s'appelle... ? » ouverte. */
function callHen(sim: Sim, doer: CharacterId): boolean {
  const hen = sim.world.hens.find((h) => h.namedBy === null);
  if (hen === undefined) return false;
  // Le geste précédent finit avant qu'Agir reparte (l'appui est gardé en attendant).
  idle(sim, 15);
  teleport(sim, doer, hen.pos.x + 0.7, hen.pos.y + 0.3);
  // Agir vise ce qui est devant soi: on se tourne vers la poule.
  character(sim, doer).facing = Math.atan2(-0.3, -0.7);
  apply(sim, doer, [{ type: 'act' }]);
  for (let i = 0; i < 30 && character(sim, doer).dialogue === null; i++) idle(sim, 1);
  return character(sim, doer).dialogue !== null;
}

/** Un mauvais nom pour la poule appelée (le premier nom qui n'est pas le sien). */
function answerWrong(sim: Sim, doer: CharacterId): void {
  const d = character(sim, doer).dialogue;
  const hen = sim.world.hens.find((h) => h.id === d?.villager);
  const wrong = sim.world.hens.findIndex((h) => h.name !== hen?.name && h.namedBy === null);
  apply(sim, doer, [{ type: 'dialogue_choice', choice: `name:${String(Math.max(0, wrong))}` }]);
}

function answerRight(sim: Sim, doer: CharacterId): void {
  const d = character(sim, doer).dialogue;
  const index = sim.world.hens.findIndex((h) => h.id === d?.villager);
  apply(sim, doer, [{ type: 'dialogue_choice', choice: `name:${String(Math.max(0, index))}` }]);
}

// ---------------------------------------------------------------------------
// Tour 7: onglet Souvenirs. La page s'ouvre sur l'onglet avec `onglet=souvenirs`. Avec la graine
// de la démo, les robots finissent les poules au jour 5 (p1 informé), voient le héron au jour 6
// (quête de Jeanne), finissent le mot de Lucie (p2 informé) et voient les oies au jour 11.

/** Journée en cours, personne en conversation ni dans un menu, le carnet ouvert chez `me`. */
function openNotebookWhenFree(sim: Sim, me: CharacterId, until: (s: Sim) => boolean): void {
  playUntil(sim, (s) => until(s) && s.world.phase === 'day' && s.world.scene === null && s.world.characters.every((c) => c.dialogue === null && c.menu === null));
  apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
}

/**
 * Le dernier souvenir arrive une fois l'interface montée: il porte le filet des nouveautés,
 * comme une entrée née pendant la séance.
 */
function lastMemoryAfterMount(sim: Sim): () => void {
  const entry = sim.world.memories.moments.pop();
  return () => {
    if (entry !== undefined) sim.world.memories.moments.push(entry);
  };
}

function memory(id: string, first: number, hintTo: CharacterId | null, hintFrom: string | null, count = 1, last = first): MomentMemoryEntry {
  return { id, first, hintTo, hintFrom, count, last };
}

// ---------------------------------------------------------------------------
// Tour 7: ligne d'observation de la brume et de la chevrette (M-26, M-27). La graine de la démo
// ne les tire pas: à l'aube du jour 2, le moment est posé à la main, puis les deux sont placés.

/** L'aube du jour 2, le moment `id` en attente (ses conditions de météo ne comptent pas ici). */
function dawnMoment(sim: Sim, id: string): MomentToday | null {
  playUntil(sim, (s) => s.world.clock.day === 2 && s.world.phase === 'day' && s.world.clock.running && s.world.scene === null);
  const def = momentDef(sim.content, id);
  if (def === null) return null;
  const today = newToday(sim, def, 'ambient');
  today.phase = 'waiting';
  today.phaseTick = sim.world.tick;
  sim.world.moments.today = today;
  for (const c of sim.world.characters) {
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.status = 'active';
    c.crafting = null;
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  return today;
}

/** Place `id` en (x, y), immobile, tourné vers `look`. */
function stand(sim: Sim, id: CharacterId, x: number, y: number, look: { x: number; y: number }): void {
  teleport(sim, id, x, y);
  const c = character(sim, id);
  c.facing = Math.atan2(look.y - y, look.x - x);
  c.speed = 0;
}

// Places du test M-18: de part et d'autre de l'Aubrune, là où elle n'a pas quatre mètres.
const MIST_NORTH = { x: 29.5, y: 38.5 };
const MIST_SOUTH = { x: 29.5, y: 42.5 };

/** Pas jusqu'au prochain regard de la chevrette, ou `null`. */
function untilDeerLook(sim: Sim, today: MomentToday): number | null {
  const def = momentDef(sim.content, today.id);
  const freeze = def?.watch.freeze ?? null;
  if (def === null || freeze === null) return null;
  for (let k = 0; k < 30 * 60; k++) if (freezeState(def, freeze, today, sim.world.tick + k, sim.world.seed).kind === 'look') return k;
  return null;
}

/** La chevrette du pré: p1 à 4 m d'elle, p2 `p2Distance` m à l'ouest et 2 m au nord (hors du buisson), tournés vers elle. */
function deerScene(sim: Sim, p2Distance: number): { today: MomentToday; deer: { x: number; y: number } } | null {
  const today = dawnMoment(sim, 'roe_deer');
  const deer = sim.map.points.roe_deer_graze;
  if (today === null || deer === undefined) return null;
  stand(sim, 'p1', deer.x - 4, deer.y + 0.5, deer);
  stand(sim, 'p2', deer.x - p2Distance, deer.y - 2, deer);
  idle(sim, 15);
  return { today, deer };
}

// ---------------------------------------------------------------------------
// Tour 8: la suite après le jour 15. Ces situations partent des sauvegardes de référence du
// format 5 (`tests/donnees/sauvegardes`): la fin de la démo (jour 15, écran d'étape) et l'été
// (jour 25). `scenarioSave` dit laquelle charger; la page la restaure au lieu d'une partie neuve.

/** Sauvegarde de référence d'où part un scénario du tour 8 ou 9, ou `null` (partie neuve). */
export function scenarioSave(name: string): string | null {
  const t9 = TOUR9_SAVES[name];
  if (t9 !== undefined) return t9;
  if (name.startsWith('etape-43') || ['ete-hud', 'ete-carnet', 'ete-caisse', 'ete-courrier', 'ete-nuit', 'brume-matin'].includes(name)) return 'format-5-ete-jour-25.json';
  if (name.startsWith('etape') || name === 'saison-ete' || name === 'reprise') return 'format-5-fin-de-la-demo.json';
  return null;
}

const stayChoice = (choice: 'stay' | 'finish' | null): Intent => ({ type: 'stage_choice', choice });

/** Les deux choisissent « Rester » sur l'écran d'étape: la journée reprend. */
function stayBoth(sim: Sim): void {
  apply(sim, 'p1', [stayChoice('stay')]);
  apply(sim, 'p2', [stayChoice('stay')]);
}

/** Personne en conversation, dans un menu ou une scène: le HUD seul. */
function free(s: Sim): boolean {
  return s.world.phase === 'day' && s.world.scene === null && s.world.scripts.length === 0 && s.world.characters.every((c) => c.status === 'active' && c.dialogue === null && c.menu === null);
}

/** Une partie reprise au petit-déjeuner s'ouvre sur l'écran titre (« Reprendre »): les deux l'ont passé. */
function pastTitle(sim: Sim): void {
  apply(sim, 'p1', [{ type: 'title_ready', ready: true }]);
  apply(sim, 'p2', [{ type: 'title_ready', ready: true }]);
}

/** L'écran d'étape suivant (samedi 43, ou 64 depuis l'automne): les robots restent à chaque étape jusque-là. */
function summerEnd(sim: Sim): void {
  const robot = createRobot({ stages: 'stay' });
  let ticks = 0;
  while (sim.world.phase !== 'ended' && ticks < 30 * MAX_TICKS) {
    step(sim, robot.decide(sim));
    ticks++;
  }
}

// ---------------------------------------------------------------------------
// Tour 9: tableau du quai (catalogue par rayons, annonces, chantiers), établi de Basile, courrier à
// titres, carnet, écran du jour 64. Ces situations partent des références du format 6: l'été
// (jour 25: le banc du gué bâti, les jardinières à 600 sur 700, une planche apportée pour le banc
// du pignon) et l'automne (jour 62: tout est bâti, une vingtaine de lettres).

const SUMMER_25 = 'format-6-ete-jour-25.json';
const AUTUMN_62 = 'format-6-automne-jour-62.json';

const TOUR9_SAVES: Readonly<Record<string, string>> = {
  'tableau-catalogue': SUMMER_25,
  'tableau-catalogue-ferme': SUMMER_25,
  'tableau-annonces': SUMMER_25,
  'tableau-annonce-faite': SUMMER_25,
  'tableau-annonce-retiree': SUMMER_25,
  'tableau-chantiers': SUMMER_25,
  'tableau-chantiers-accord': SUMMER_25,
  'tableau-chantiers-tous': AUTUMN_62,
  'etabli-basile': SUMMER_25,
  'courrier-titres': AUTUMN_62,
  'carnet-tour9': AUTUMN_62,
  'etape-64': AUTUMN_62,
};

/** Onglet du tableau du quai qu'ouvre un scénario du tour 9, ou `null`. */
export function scenarioBoardTab(name: string): 'catalogue' | 'annonces' | 'chantiers' | null {
  if (name.startsWith('tableau-catalogue')) return 'catalogue';
  if (name.startsWith('tableau-annonce')) return 'annonces';
  if (name.startsWith('tableau-chantiers')) return 'chantiers';
  return null;
}

/** Devant le tableau du quai, le tableau ouvert. */
function atBoard(sim: Sim, id: CharacterId): void {
  near(sim, id, 'notice_board');
  apply(sim, id, [{ type: 'menu', menu: 'catalogue' }]);
}

/** L'annonce à deux du mercredi 26 vient d'être épinglée (la veille, celle du dimanche est faite). */
function wednesdayAnnonce(sim: Sim): void {
  playUntil(sim, (s) => s.world.board.current?.posted === 26 && free(s) && at(s, 26, 7 * HOUR));
}

/** Le catalogue du dimanche 30: deux pages d'été parues, un outil commandé par l'autre, le moulin d'Odette souhaité. */
function catalogueSunday(sim: Sim, other: CharacterId): void {
  const w = sim.world;
  // La livraison du samedi 29 est passée: les arrosoirs et le chapeau sont arrivés.
  w.clock.day = 30;
  w.clock.minutes = 10 * HOUR;
  w.catalogueOrders = ['axe_forged'];
  w.catalogueOrderBy = [other];
  w.catalogueBought = { ...w.catalogueBought, axe_forged: 1 };
  if (!w.dialoguesDone.includes('odette_wish')) w.dialoguesDone.push('odette_wish');
}

/** Après le premier pas (qui rattrape la journée posée à la main): la bourse d'un dimanche d'été. */
function catalogueSundayPurse(sim: Sim): void {
  sim.world.purse = 640;
  sim.world.proposals = [];
}

function tour9(sim: Sim, name: string, me: CharacterId, other: CharacterId): (() => void) | undefined | null {
  switch (name) {
    case 'tableau-catalogue':
      catalogueSunday(sim, other);
      atBoard(sim, me);
      catalogueSundayPurse(sim);
      return undefined;
    case 'tableau-catalogue-ferme':
      // Samedi 29 au matin: les commandes sont parties avec la poste, rien ne se commande avant 10 h.
      sim.world.clock.day = 29;
      sim.world.clock.minutes = 8 * HOUR;
      atBoard(sim, me);
      return undefined;
    case 'tableau-annonces': {
      // Le coup de main du dimanche 30 (des produits à donner, une liste à cocher).
      playUntil(sim, (s) => s.world.board.current?.posted === 30 && free(s) && at(s, 30, 7 * HOUR));
      // Une partie des dons est faite (comme si l'un des deux était déjà passé chez l'habitant).
      const a = sim.world.board.current;
      const def = sim.content.annonces.find((x) => x.id === a?.gabarit);
      const line = def?.variants[a?.variant ?? 0]?.[0];
      if (def !== undefined && line !== undefined) {
        const key = `given:${def.giver}:${line.item}`;
        sim.world.counters.duo[key] = (sim.world.counters.duo[key] ?? 0) + Math.floor(line.count / 2);
      }
      atBoard(sim, me);
      return undefined;
    }
    case 'tableau-annonce-faite': {
      wednesdayAnnonce(sim);
      const a = sim.world.board.current;
      if (a !== null) {
        a.state = 'done';
        a.by = me;
        a.closedDay = 26;
      }
      atBoard(sim, me);
      return undefined;
    }
    case 'tableau-annonce-retiree': {
      wednesdayAnnonce(sim);
      const a = sim.world.board.current;
      if (a !== null) {
        a.state = 'expired';
        a.closedDay = 28;
      }
      atBoard(sim, me);
      return undefined;
    }
    case 'tableau-chantiers':
      playUntil(sim, (s) => free(s) && at(s, 25, 13 * HOUR));
      sim.world.purse = Math.max(sim.world.purse, 320);
      atBoard(sim, me);
      return undefined;
    case 'tableau-chantiers-accord':
      // p1 propose de verser le reste (100 sous, l'accord de l'autre); chacun devant le tableau.
      playUntil(sim, (s) => free(s) && at(s, 25, 13 * HOUR));
      sim.world.purse = Math.max(sim.world.purse, 320);
      atBoard(sim, 'p1');
      near(sim, 'p2', 'notice_board', -0.9, 0.4);
      apply(sim, 'p2', [{ type: 'menu', menu: 'catalogue' }]);
      apply(sim, 'p1', [{ type: 'improvement_pay', improvement: 'quay_planters', amount: null }]);
      return undefined;
    case 'tableau-chantiers-tous':
      atBoard(sim, me);
      return undefined;
    case 'etabli-basile':
      playUntil(sim, (s) => free(s) && at(s, 25, 13 * HOUR));
      fillBag(sim, me);
      sim.world.purse = Math.max(sim.world.purse, 520);
      near(sim, me, 'sawmill_workbench');
      apply(sim, me, [{ type: 'menu', menu: 'workbench' }]);
      return undefined;
    case 'courrier-titres':
      // Les deux dernières lettres de la coopérative pas encore lues chez ce joueur.
      for (const l of sim.world.letters.slice(-2)) l.read = l.read.filter((id) => id !== me);
      apply(sim, me, [{ type: 'menu', menu: 'letter' }]);
      return undefined;
    case 'carnet-tour9': {
      // L'annonce d'avant n'a pas été faite: elle est « Retirée » au carnet, en gris.
      const prev = sim.world.board.previous;
      if (prev !== null) {
        prev.state = 'expired';
        prev.by = null;
      }
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return undefined;
    }
    case 'etape-64':
      summerEnd(sim);
      return undefined;
    default:
      return null;
  }
}

function tour8(sim: Sim, name: string, me: CharacterId, other: CharacterId): (() => void) | undefined | null {
  switch (name) {
    case 'etape':
      return undefined;
    case 'etape-moi-reste':
      apply(sim, me, [stayChoice('stay')]);
      return undefined;
    case 'etape-autre-reste':
      apply(sim, other, [stayChoice('stay')]);
      return undefined;
    case 'etape-autre-finit':
      apply(sim, other, [stayChoice('finish')]);
      return undefined;
    case 'etape-desaccord':
      apply(sim, me, [stayChoice('finish')]);
      apply(sim, other, [stayChoice('stay')]);
      return undefined;
    case 'etape-finir':
      apply(sim, me, [stayChoice('finish')]);
      apply(sim, other, [stayChoice('finish')]);
      return undefined;
    case 'reprise':
      // Les deux restent après le montage: la notification « La Halte continue » paraît chez soi.
      return () => {
        stayBoth(sim);
      };
    case 'etape-43':
      summerEnd(sim);
      return undefined;
    case 'etape-43-finir':
      summerEnd(sim);
      apply(sim, other, [stayChoice('finish')]);
      return undefined;
    case 'saison-ete':
      // Premier matin de l'été (jour 22): la carte de saison sous la météo.
      stayBoth(sim);
      playUntil(sim, (s) => s.world.phase === 'breakfast' && s.world.clock.day >= 22);
      pastTitle(sim);
      return undefined;
    case 'brume-matin':
      // Un matin de brume (retouché si la graine n'en tire pas ce jour-là).
      playUntil(sim, (s) => s.world.phase === 'breakfast' && s.world.clock.day >= 26);
      sim.world.morningMist = true;
      if (sim.world.weather === 'rain') sim.world.weather = 'sunny';
      pastTitle(sim);
      return undefined;
    case 'ete-hud':
      playUntil(sim, (s) => free(s) && at(s, 26, 9 * HOUR));
      return undefined;
    case 'ete-carnet':
      playUntil(sim, (s) => free(s) && at(s, 26, 9 * HOUR));
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return undefined;
    case 'ete-courrier':
      playUntil(sim, (s) => free(s) && at(s, 26, 9 * HOUR));
      apply(sim, me, [{ type: 'menu', menu: 'letter' }]);
      return undefined;
    case 'ete-caisse':
      playUntil(sim, (s) => free(s) && at(s, 27, 15 * HOUR));
      near(sim, me, 'coop_crate');
      apply(sim, me, [{ type: 'menu', menu: 'crate' }]);
      return undefined;
    case 'ete-nuit':
      playUntil(sim, (s) => s.world.phase === 'night' && s.world.clock.day >= 26);
      return undefined;
    default:
      return null;
  }
}

/**
 * Prépare la situation demandée. `me`: le personnage de cette page. Renvoie parfois la suite à
 * jouer une fois l'interface montée (une notification déjà là au montage est ancienne et ne
 * s'affiche pas): la page l'appelle juste après sa première image, les tests aussitôt.
 */
export function setupScenario(sim: Sim, name: string, me: CharacterId): (() => void) | undefined {
  const other: CharacterId = me === 'p1' ? 'p2' : 'p1';
  const later = tour9(sim, name, me, other);
  if (later !== null) return later;
  const suite = tour8(sim, name, me, other);
  if (suite !== null) return suite;
  const day5 = (): void => {
    playUntil(sim, (s) => at(s, 5, 9 * HOUR + 20));
  };
  switch (name) {
    case 'titre':
      return;
    case 'creation':
      apply(sim, other, [{ type: 'title_ready', ready: true }]);
      return;
    case 'creation-autre':
      apply(sim, other, [{ type: 'title_ready', ready: true }, { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 }]);
      return;
    case 'scene':
      apply(sim, other, [{ type: 'title_ready', ready: true }, { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 }]);
      apply(sim, me, [{ type: 'title_ready', ready: true }, { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 }]);
      playUntil(sim, (s) => s.world.scene !== null);
      return;
    case 'jour':
      day5();
      fillBag(sim, me);
      return;
    case 'hud':
      // Le HUD seul: la scène d'arrivée jouée par le robot, personne en conversation ni dans un menu.
      playUntil(
        sim,
        (s) =>
          s.world.phase === 'day' &&
          s.world.scene === null &&
          s.world.quests.some((q) => q.id === 'first_train' && q.status === 'done') &&
          s.world.characters.every((c) => c.status === 'active' && c.dialogue === null && c.menu === null),
      );
      return;
    case 'premier-jour':
      playUntil(sim, (s) => s.world.phase === 'day' && s.world.tick > 60);
      return;
    case 'carnet':
    case 'quetes':
    case 'courrier':
      day5();
      fillBag(sim, me);
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return;
    case 'caisse':
      day5();
      fillBag(sim, me);
      near(sim, me, 'coop_crate');
      apply(sim, me, [{ type: 'menu', menu: 'crate' }]);
      return;
    case 'catalogue':
      day5();
      sim.world.purse = Math.max(sim.world.purse, 198);
      near(sim, me, 'notice_board');
      apply(sim, me, [{ type: 'menu', menu: 'catalogue' }]);
      return;
    case 'comptoir':
    case 'vendre':
      day5();
      fillBag(sim, me);
      sim.world.purse = Math.max(sim.world.purse, 214);
      near(sim, me, 'grocery_counter');
      apply(sim, me, [{ type: 'menu', menu: 'shop' }]);
      return;
    case 'etabli':
      day5();
      fillBag(sim, me);
      near(sim, me, 'sawmill_workbench');
      apply(sim, me, [{ type: 'menu', menu: 'workbench' }]);
      return;
    case 'rechaud':
    case 'coffre':
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      fillBag(sim, me);
      apply(sim, me, [{ type: 'menu', menu: name === 'rechaud' ? 'stove' : 'chest' }]);
      return;
    case 'veillee':
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      return;
    case 'dialogue':
      playUntil(sim, (s) => at(s, 2, 11 * HOUR + 30));
      near(sim, me, 'grocery_counter', 0, 1.2);
      apply(sim, me, [{ type: 'move_to', target: { kind: 'villager', villager: 'odette' }, act: true }]);
      return;
    case 'achat':
      day5();
      sim.world.purse = Math.max(sim.world.purse, 214);
      near(sim, other, 'grocery_counter');
      apply(sim, other, [{ type: 'menu', menu: 'shop' }, { type: 'buy', item: 'mattress', count: 1 }, { type: 'menu', menu: null }]);
      return;
    case 'amenagement': {
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      const c = character(sim, me);
      const free = c.bag.findIndex((s, i) => s === null && i < 8);
      c.bag[free < 0 ? 0 : free] = stack('table', 1);
      c.selected = free < 0 ? 0 : free;
      return;
    }
    case 'coin': {
      // Coin à soi: les deux dans la pièce, chacun son coin, une chaise en main tournée vers le coin de l'autre (refus).
      playUntil(sim, (s) => s.world.clock.day >= 4 && s.world.clock.veillee && s.world.phase === 'day');
      const room = sim.map.house.room;
      teleport(sim, me, room.x + 2.5, room.y + 2.5);
      teleport(sim, other, room.x + 1.5, room.y + 3.5);
      for (const id of [me, other]) character(sim, id).inHouse = true;
      apply(sim, other, [{ type: 'corner', x: room.x + 1, y: room.y + 3 }]);
      const c = character(sim, me);
      // Le premier carré libre en partant du réchaud (les robots ont meublé la pièce).
      for (let y = room.y + 1; y <= room.y + room.h - 1 && (c.corner ?? null) === null; y++) {
        for (let x = room.x + room.w - 1; x >= room.x + 1 && (c.corner ?? null) === null; x--) apply(sim, me, [{ type: 'corner', x, y }]);
      }
      const free = c.bag.findIndex((s, i) => s === null && i < 8);
      c.bag[free < 0 ? 0 : free] = stack('chair', 1);
      c.selected = free < 0 ? 0 : free;
      c.facing = Math.PI;
      return;
    }
    case 'nuit':
      playUntil(sim, (s) => s.world.phase === 'night' && s.world.clock.day >= 4);
      return;
    case 'petit-dejeuner':
      playUntil(sim, (s) => s.world.phase === 'breakfast' && s.world.clock.day >= 5);
      return;
    case 'caisse-expediee':
      // Samedi 8 après le départ du train: la commande 1 est payée, la caisse dit « Expédiée ».
      playUntil(sim, (s) => s.world.clock.day === 8 && s.world.orderResult !== null && s.world.scene === null && s.world.scripts.length === 0 && s.world.phase === 'day');
      near(sim, me, 'coop_crate');
      apply(sim, me, [{ type: 'menu', menu: 'crate' }]);
      return;
    case 'caisse-commande2':
      playUntil(sim, (s) => at(s, 9, 9 * HOUR));
      near(sim, me, 'coop_crate');
      apply(sim, me, [{ type: 'menu', menu: 'crate' }]);
      return;
    case 'catalogue2':
      playUntil(sim, (s) => at(s, 10, 9 * HOUR));
      sim.world.purse = Math.max(sim.world.purse, 150);
      near(sim, me, 'notice_board');
      apply(sim, me, [{ type: 'menu', menu: 'catalogue' }]);
      return;
    case 'carnet2':
      playUntil(sim, (s) => s.world.phase === 'day' && s.world.scene === null && s.world.quests.some((q) => q.id === 'handcar' && q.status === 'active'));
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return;
    case 'nuit2':
      playUntil(sim, (s) => s.world.phase === 'night' && s.world.clock.day >= 11);
      return;
    case 'fin':
      playUntil(sim, (s) => s.world.phase === 'ended');
      return;
    case 'moment-ensemble':
      heronTogether(sim);
      return;
    case 'moment-partenaire':
      // p1 regarde le héron, p2 est reparti vers la place.
      heronTogether(sim);
      near(sim, 'p2', 'notice_board');
      idle(sim, 2);
      return;
    case 'moment-pose': {
      // p1 arrive au bord du gué en tournant le dos au héron; p2 est déjà en place.
      heronTogether(sim);
      const c = character(sim, 'p1');
      c.facing += Math.PI;
      idle(sim, 2);
      return;
    }
    case 'moment-oies': {
      // Assis à deux sur le banc de la berge avant 16 h 30: les oies se reposent encore.
      playUntil(sim, (s) => s.world.moments.today?.id === 'geese' && s.world.moments.today.phase === 'waiting' && s.world.clock.minutes >= 15 * HOUR);
      const bench = benchById(sim.map, 'riverbank_bench');
      if (bench === null) return;
      (['p1', 'p2'] as const).forEach((id, slot) => {
        const place = seatPlace(bench, slot, sim.content.settings.benches, { x: 0, y: 0, facing: 0 });
        teleport(sim, id, place.x, place.y);
        const c = character(sim, id);
        c.facing = place.facing;
        c.seat = { bench: bench.id, slot, since: sim.world.tick };
      });
      idle(sim, 2);
      return;
    }
    case 'brume-meme-rive':
      // Les deux sur la rive nord, face à face et immobiles: la simulation ne compte pas.
      if (dawnMoment(sim, 'mist') === null) return;
      stand(sim, 'p1', MIST_NORTH.x, MIST_NORTH.y, { x: 31.5, y: 38.5 });
      stand(sim, 'p2', 31.5, 38.5, MIST_NORTH);
      idle(sim, 30);
      return;
    case 'brume-de-dos':
      // Une rive chacun, p2 tourne le dos à p1.
      if (dawnMoment(sim, 'mist') === null) return;
      stand(sim, 'p1', MIST_NORTH.x, MIST_NORTH.y, MIST_SOUTH);
      stand(sim, 'p2', MIST_SOUTH.x, MIST_SOUTH.y, { x: 29.5, y: 46 });
      idle(sim, 30);
      return;
    case 'brume-face-a-face':
      // Une rive chacun, face à face: l'anneau se remplit (1,5 s sur 3).
      if (dawnMoment(sim, 'mist') === null) return;
      stand(sim, 'p1', MIST_NORTH.x, MIST_NORTH.y, MIST_SOUTH);
      stand(sim, 'p2', MIST_SOUTH.x, MIST_SOUTH.y, MIST_NORTH);
      idle(sim, 45);
      return;
    case 'chevrette-broute':
      // Elle broute: p1 à 4 m, p2 à 7 m (encore un peu loin).
      deerScene(sim, 7);
      return;
    case 'chevrette-regarde': {
      // Elle regarde, p2 encore à 7 m: personne ne compte, on se fige.
      const scene = deerScene(sim, 7);
      const k = scene === null ? null : untilDeerLook(sim, scene.today);
      if (k !== null) idle(sim, k + 15);
      return;
    }
    case 'chevrette-ensemble': {
      // Elle regarde, les deux en place: l'anneau tourne.
      const scene = deerScene(sim, 4.5);
      const k = scene === null ? null : untilDeerLook(sim, scene.today);
      if (k !== null) idle(sim, k + 30);
      return;
    }
    case 'chevrette-effarouchee': {
      // p2 a bougé pendant un regard: elle frappe du pied et recule.
      const scene = deerScene(sim, 5);
      const k = scene === null ? null : untilDeerLook(sim, scene.today);
      if (k === null) return;
      idle(sim, k + 10);
      for (let i = 0; i < 6; i++) step(sim, { controls: { p2: { seq: i, moveX: 1, moveY: 0, actHeld: false } }, intents: [] });
      idle(sim, 15);
      return;
    }
    case 'moment-echelle': {
      // Pause de l'échelle: p1 a lâché, p2 tient (situation posée à la main: la graine de la démo
      // ne tire pas l'échelle; à regarder avec `temps=arrete`).
      heronTogether(sim);
      const today = sim.world.moments.today;
      if (today !== null) sim.world.moments.today = { ...today, id: 'ladder', origin: 'quest', phase: 'climax', paused: true, elapsed: 2.5, watchTicks: 0 };
      near(sim, 'p1', 'nest_oak_basile', -2.2, 0.4);
      near(sim, 'p2', 'nest_oak_basile', 1.2, 0.4);
      character(sim, 'p1').holding = null;
      character(sim, 'p2').holding = 'ladder_hold_west';
      return;
    }
    case 'confidence':
    case 'carnet-confidence': {
      // Une confidence du matin pour p1 seul (les mésanges de Basile); p2 n'a rien.
      playUntil(sim, (s) => s.world.phase === 'breakfast' && s.world.clock.day >= 5);
      const today = sim.world.moments.today;
      const base = today ?? {
        id: 'tits', origin: 'ambient' as const, day: sim.world.clock.day, phase: 'absent' as const, phaseTick: sim.world.tick, startTick: null,
        elapsed: 0, paused: false, watchTicks: 0, watching: { p1: false, p2: false }, early: false, noticed: [], hintTo: null, shyUntil: 0,
      };
      sim.world.moments.today = { ...base, id: 'tits', origin: 'ambient', phase: 'absent', hintTo: 'p1' };
      character(sim, 'p1').momentHint = { moment: 'tits', text: sim.content.texts.messages.moment_tits_hint ?? '' };
      if (name === 'carnet-confidence') {
        for (const id of ['p1', 'p2'] as const) apply(sim, id, [{ type: 'start_day' }]);
        apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      }
      return;
    }
    case 'poules-carnet':
      hensToName(sim);
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return;
    case 'poules-appel':
      // p2 appelle la deuxième poule: la première est déjà nommée (son nom est grisé).
      hensToName(sim);
      if (callHen(sim, 'p2')) answerRight(sim, 'p2');
      callHen(sim, 'p2');
      return;
    case 'poules-erreur':
      // La conversation d'appel ouverte chez p2; le mauvais nom tombe une fois l'interface montée.
      hensToName(sim);
      callHen(sim, 'p2');
      return () => {
        answerWrong(sim, 'p2');
      };
    case 'poules-coup-de-coude':
      // Un premier mauvais nom; le second (et le coup de coude chez l'informé) une fois l'interface montée.
      hensToName(sim);
      if (callHen(sim, 'p2')) answerWrong(sim, 'p2');
      return () => {
        if (callHen(sim, 'p2')) answerWrong(sim, 'p2');
      };
    case 'poules-coup-de-coude-carnet':
      hensToName(sim);
      for (let i = 0; i < 2; i++) if (callHen(sim, 'p2')) answerWrong(sim, 'p2');
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return;
    case 'lucie-carnet':
      // Firmin a répondu à p2 (l'informé du mot de Lucie): c'est à p1 d'aller le dire à Jeanne.
      playUntil(sim, (s) => s.world.secrets.entries.some((e) => e.quest === 'lucie_note' && e.revealed) && s.world.characters.every((c) => c.dialogue === null && c.menu === null));
      apply(sim, me, [{ type: 'menu', menu: 'notebook' }]);
      return;
    case 'souvenirs-vide':
      // Début de partie: la page vide et la rumeur du bourg.
      openNotebookWhenFree(sim, me, (s) => at(s, 2, 9 * HOUR));
      return;
    case 'souvenirs-premier':
      // Le premier souvenir, né dans la séance: le renard du jour 3, confidence chez p2.
      openNotebookWhenFree(sim, me, (s) => at(s, 3, 21 * HOUR));
      sim.world.memories.moments = [memory('fox', 3, 'p2', null)];
      return lastMemoryAfterMount(sim);
    case 'souvenirs-secret':
      // Les noms des poules trouvés (p1 informé, p2 a appelé): une quête secrète finie.
      openNotebookWhenFree(sim, me, (s) => s.world.memories.secrets.some((m) => m.quest === 'hen_names'));
      return;
    case 'souvenirs-plusieurs':
      // Le lendemain des oies: deux quêtes secrètes et deux moments de quête, une saison.
      openNotebookWhenFree(sim, me, (s) => at(s, 12, 9 * HOUR));
      return lastMemoryAfterMount(sim);
    case 'souvenirs-deux-annees': {
      // Une longue partie (deux années): les quêtes de la démo, puis des moments revus d'une saison à l'autre.
      openNotebookWhenFree(sim, me, (s) => at(s, 12, 9 * HOUR));
      sim.world.clock.day = 96;
      sim.world.memories.moments = [
        memory('heron', 6, null, 'jeanne', 3, 47),
        memory('geese', 11, null, 'firmin', 2, 95),
        memory('fox', 16, 'p1', null, 5, 88),
        memory('glowworms', 23, 'p2', 'odette', 2, 37),
        memory('ladder', 31, null, 'basile'),
        memory('tits', 90, 'p1', 'basile'),
      ];
      return;
    }
    default:
      return undefined;
  }
}
