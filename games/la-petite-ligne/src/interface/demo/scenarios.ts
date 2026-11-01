/**
 * Situations de la page de démonstration de l'interface (`?scenario=...`):
 * le robot de la simulation joue jusqu'au moment voulu, puis quelques
 * retouches de l'état montrent l'écran demandé. Outil de développement et
 * de captures seulement: le jeu ne passe jamais par ici.
 */
import type { Intent } from '../../etat/actions';
import type { CharacterId, ItemStack, MomentMemoryEntry } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
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

/**
 * Prépare la situation demandée. `me`: le personnage de cette page. Renvoie parfois la suite à
 * jouer une fois l'interface montée (une notification déjà là au montage est ancienne et ne
 * s'affiche pas): la page l'appelle juste après sa première image, les tests aussitôt.
 */
export function setupScenario(sim: Sim, name: string, me: CharacterId): (() => void) | undefined {
  const other: CharacterId = me === 'p1' ? 'p2' : 'p1';
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
