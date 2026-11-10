/**
 * Démonstration de l'interface seule, sur une vraie partie neuve et un état factice choisi par
 * l'ancre de l'adresse (`#repos`, `#bulle`, `#coup-d-oeil`, `#dialogue-ecriture`,
 * `#dialogue-choix`, `#carnet-sans-sac`, `#carnet-sac`, `#rangement`, et un onglet du carnet:
 * `#carnet-quetes`, `-habitants`, `-collections`, `-carte`, `-tenues`, `-reglages`, chacun avec le
 * suffixe `-long` pour un contenu très long; le sac en objet: `#carnet-sac-equiper`, `-refus`,
 * `-malle`). Sert aux captures.
 * Les onglets lisent un état factice (`carnet/fictif.ts`) et le vrai plan d'Aubrune.
 */
import { loadContent } from '../../donnees/charger';
import { DATA_FILES } from '../../donnees/fichiers';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { WorldState } from '../../etat/monde';
import type { Aim } from '../../simulation/briques/types';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { createWorld } from '../../simulation/noyau/monde';
import { dummySources, stressSources } from '../carnet/fictif';
import { parsePlan } from '../carnet/plan';
import { memoryFollow } from '../carnet/quetes';
import { worldSources } from '../carnet/lectures';
import { createInterface } from '../index';
import { histoireFiles, setupHistoire } from './histoire';
import planAubrune from '../../../../../docs/jeux/jeu-1/refonte/carte-aubrune/plan.json';

const content = loadContent({ ...DATA_FILES, ...histoireFiles() });
const world: WorldState = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const state = location.hash.slice(1) || 'repos';
const me = world.players[0];
const other = world.players[1];
world.minutes = 10 * 60 + 40;
me.money = 21_450;
world.common.chest = 5_000;
me.toolbar[0] = { item: 'hache-forgee', count: 1, wear: 6 };
me.toolbar[1] = { item: 'hache', count: 1 };
me.toolbar[2] = { item: 'pain', count: 2 };
me.selected = 0;
me.body.x = 10;
me.body.y = 10;
other.body.x = 22;
other.body.y = 4;
const TABS_DEMO = ['quetes', 'habitants', 'collections', 'carte', 'tenues', 'reglages'] as const;
// Suffixe `-long`: contenu très long pour vérifier le défilement (banc des petites fenêtres).
const longContent = state.endsWith('-long');
// `#carnet-quetes-histoire`: les vraies suites d'Aubrune (deux actes, `-3`: trois), lues dans l'état.
const sagaDemo = /^carnet-quetes-histoire(-3)?$/.exec(state);
const tabName = longContent
  ? state.slice(0, -'-long'.length)
  : sagaDemo === null
    ? state
    : 'carnet-quetes';
const tabStep = TABS_DEMO.findIndex((t) => tabName === `carnet-${t}`) + 1;
if (tabStep > 0) {
  // Les joueurs au quai d'Aubrune, en mètres du plan.
  me.body.x = 140;
  me.body.y = 104;
  other.body.x = 168;
  other.body.y = 116;
}

let aim: Aim | null = null;
if (state === 'bulle') {
  me.needs.hunger = 12;
  me.tiers.hunger = 'low';
  aim = {
    kind: 'ground',
    id: 'sol-1',
    action: 'pickup',
    verb: 'Ramasser',
    refusal: 'pockets-full',
    x: 0,
    y: 0,
  };
} else if (state !== 'repos') {
  aim = {
    kind: 'prop',
    id: 'pommier',
    action: 'gather',
    verb: 'Cueillir',
    refusal: null,
    x: 0,
    y: 0,
  };
}
const histoire = setupHistoire(state, world);
if (histoire.noAim) aim = null;
if (sagaDemo !== null) {
  const all = (ids: readonly string[]): string[] => [...ids];
  world.progress.quests['le-train-de-5h12'] = {
    chapter: 'logement-fourni',
    step: 'reponse',
    done: true,
    passed: all([
      'quai',
      'lettre',
      'maison',
      'pension',
      'pompe',
      'souper',
      'nuit-pension',
      'outils',
      'debroussailler',
      'abattre',
      'besaces',
      'toit',
      'graines',
      'potager',
      'poules',
      'vente-odette',
      'vente-achille',
      'premiere-nuit',
      'reponse',
    ]),
  };
  const third = sagaDemo[1] !== undefined;
  world.progress.quests['la-minute-d-ecart'] = third
    ? { chapter: 'le-premier-train', step: 'farce', done: true, passed: [] }
    : {
        chapter: 'la-halte-en-service',
        step: 'tranchee',
        done: false,
        passed: ['occupation', 'cuisine', 'article-7'],
      };
  if (third)
    world.progress.quests['ceux-qui-partent'] = {
      chapter: 'la-lueur',
      step: 'lucie',
      done: false,
      passed: ['chambre', 'coupe', 'trappe', 'registre'],
    };
}
if (state === 'coup-d-oeil') {
  me.needs.sleep = 82;
  me.tiers.sleep = 'bonus';
  me.needs.hygiene = 44;
}
if (state === 'dialogue-ecriture')
  me.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'bonjour' };
if (state === 'dialogue-choix') {
  me.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'choix' };
  me.needs.hygiene = 8;
  me.tiers.hygiene = 'low';
}
if (state === 'carnet-sac' || state === 'rangement') {
  me.bag = {
    id: 'sac-a-dos',
    slots: [
      { item: 'pomme', count: 4 },
      { item: 'buche', count: 5 },
      { item: 'planche', count: 3 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  };
}
// Sacs en objet: `-equiper` (une besace de 4 cases porte un sac de toile de 6: possible), `-refus`
// (un sac à dos de 10 cases porte un sac de toile de 6: refusé, expliqué), `-malle` (20 cases pleines).
const bagState = /^carnet-sac-(equiper|refus|malle)$/.exec(state)?.[1];
if (bagState !== undefined) {
  const total = bagState === 'malle' ? 20 : bagState === 'refus' ? 10 : 4;
  const slots: (null | { item: string; count: number })[] = Array.from(
    { length: total },
    () => null,
  );
  slots[0] = { item: 'sac-de-toile', count: 1 };
  if (bagState === 'malle')
    ['pomme', 'buche', 'planche', 'pain'].forEach((item, i) => {
      for (let k = 0; k < 4; k += 1) slots[1 + i * 4 + k] = { item, count: 2 + k };
    });
  me.bag = {
    id: bagState === 'malle' ? 'malle-a-bretelles' : bagState === 'refus' ? 'sac-a-dos' : 'besace',
    slots,
  };
}
const place = world.places[world.common.place];
if (state === 'rangement' && place !== undefined)
  place.objects['demo-coffre'] = {
    store: [
      { item: 'planche', count: 8 },
      { item: 'pain', count: 1 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  };

const listeners = new Set<(event: GameEvent) => void>();
const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
const sent = document.getElementById('envoi');

const ui = createInterface({
  root,
  view: {
    content,
    world: () => world,
    localIndex: (): PlayerIndex => 0,
    aim: () => aim,
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
  send(intent) {
    if (sent !== null) sent.textContent = JSON.stringify(intent);
    // Illustration seulement: la vraie réponse vient de la simulation (`equip_bag`, testée à part).
    if (intent.type === 'equip_bag' && intent.from.area === 'bag') {
      const def = content.bags.bags.find((b) => b.id === content.items['sac-de-toile']?.bag);
      if (def === undefined || me.bag === null) return;
      const kept = me.bag.slots.filter((_, i) => i !== intent.from.index);
      me.bag = { id: def.id, slots: Array.from({ length: def.slots }, (_, i) => kept[i] ?? null) };
      setTimeout(() => {
        emit({ type: 'bag_changed', player: 0, bag: def.id });
      }, 50);
    }
  },
  cameraYaw: () => 0,
  notebook: {
    sources:
      sagaDemo === null
        ? (longContent ? stressSources : dummySources)(parsePlan(planAubrune), ['M', 'F', 'T', 'C'])
        : worldSources(content),
    follow: memoryFollow(sagaDemo === null ? 'histoire' : 'la-minute-d-ecart'),
  },
  ...(histoire.project
    ? {
        // Projection de la démonstration: le monde à 30 px par mètre autour du joueur.
        projectToScreen: (x: number, y: number) => ({
          x: window.innerWidth / 2 + (x - me.body.x) * 30,
          y: window.innerHeight * 0.5 + (y - me.body.y) * 30,
        }),
      }
    : {}),
  editorAtStart: false,
});

function emit(event: GameEvent): void {
  for (const listener of listeners) listener(event);
}

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

let last = performance.now();
function loop(t: number): void {
  ui.frame((t - last) / 1000);
  last = t;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Gestes qui amènent l'état voulu, une fois l'interface posée.
setTimeout(() => {
  if (state === 'bulle') {
    me.selected = 2;
    emit({ type: 'money_changed', who: 0, delta: 120 });
  }
  if (histoire.event !== null) emit(histoire.event);
  for (const { at, code } of histoire.keys ?? [])
    setTimeout(() => {
      press(code);
    }, at);
  const later = histoire.later;
  if (later !== undefined)
    setTimeout(() => {
      for (const event of later.apply()) emit(event);
    }, later.at);
  if (state === 'coup-d-oeil') press('KeyG');
  if (state === 'carnet-sans-sac' || state === 'carnet-sac' || bagState !== undefined)
    press('KeyC');
  if (bagState !== undefined)
    setTimeout(() => {
      // Un pas en bas: de la barre (une rangée de 5 cases) à la première case du sac.
      press('KeyS');
    }, 400);
  if (tabStep > 0) {
    press('KeyC');
    setTimeout(() => {
      for (let i = 0; i < tabStep + (tabStep >= 2 ? 1 : 0); i += 1) press('KeyE');
    }, 400);
  }
  if (state === 'carnet-sac')
    setTimeout(() => {
      press('KeyD');
    }, 400);
  if (state === 'rangement') emit({ type: 'store_opened', player: 0, target: 'demo-coffre' });
  if (state === 'dialogue-choix')
    setTimeout(() => {
      press('ArrowDown');
    }, 400);
}, 150);
