/**
 * Écran de la basse-cour (interface.md 5.5, maquette `maquettes/basse-cour.html`): l'abri vu en
 * coupe, trois zones de gauche à droite (la mangeoire et ses jours de réserve, les bêtes, le nid
 * et ses œufs), une carte par bête (nom, cœurs, « a pondu », « ?? »), un seul geste par zone.
 * Q et D (ou les flèches) passent d'une zone à l'autre, Espace fait le geste, Retour sort.
 *
 * PROVISOIRE: la scène est dessinée en 2D (SVG), d'après l'état; elle deviendra la vue 3D du
 * poulailler (caméra de menu, interface.md 5.5). Pastilles, bulle et cartes resteront.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Content } from '../../donnees/charger';
import type { AnimalView, ShelterView } from '../../simulation/elevage/abri';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { coopModel, type CoopModel } from './modele';
import { COOP_TEXTS } from './textes';
import './basse-cour.css';

const K = 'stroke="#2a2522" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const S =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Pictos de la basse-cour (créations du studio, d'après la maquette). */
const PICTOS: Readonly<Record<string, string>> = {
  grain: `<g ${S}><path d="M6 8h12l-1.5 12a2 2 0 0 1-2 1.5h-5a2 2 0 0 1-2-1.5z"/><path d="M8 8c0-3 2-5 4-5s4 2 4 5"/><path d="M10 13h.01M14 13h.01M12 16h.01"/></g>`,
  oeuf: `<path ${S} d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/>`,
  coeur: `<path fill="currentColor" d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/>`,
  poule: `<g ${S}><path d="M4 13c0 4 3 7 8 7s8-3 8-7c0-2-1-3-3-3h-3l-1-4a3 3 0 0 0-6 0v2"/><path d="M7 6l-3 1 3 1"/><path d="M14 10c-2 0-4 1-4 3"/></g>`,
  plus: `<path ${S} d="M12 5v14M5 12h14"/>`,
  sortie: `<g ${S}><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></g>`,
  barre: `<path ${S} d="M4 4l16 16"/>`,
};

function picto(id: string, cls = ''): string {
  return `<svg class="lpl-coop-p ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PICTOS[id] ?? ''}</svg>`;
}

function hearts(n: number, max: number): string {
  return Array.from(
    { length: max },
    (_, i) => `<span class="lpl-coop-h${i < n ? '' : ' off'}">${picto('coeur')}</span>`,
  ).join('');
}

/** Coordonnées de la scène (viewBox 1366 x 768), reprises de la maquette. */
const FEEDER = { x: 300, y: 300 };
const NEST = { x: 1075, y: 380 };
const FLOOR = { left: 420, right: 900, y: 625 };

function animalX(index: number, count: number): number {
  if (count <= 1) return (FLOOR.left + FLOOR.right) / 2;
  return FLOOR.left + ((FLOOR.right - FLOOR.left) * index) / (count - 1);
}

function hen(x: number, y: number, color: string, flip: boolean, id: number): string {
  const s = 0.95 + (id % 3) * 0.06;
  return (
    `<g transform="translate(${String(x)} ${String(y)}) scale(${String(flip ? -s : s)} ${String(s)})">` +
    `<g class="lpl-coop-hen" style="animation-delay:${String(-((id * 0.53) % 1.6))}s" ${K}>` +
    `<path d="M-8 0v22M10 0v22M-16 22h12M4 22h12" fill="none" stroke="#c98a2b"/>` +
    `<path d="M-50 -40c-14 -22 -6 -40 6 -36c6 14 14 22 24 26z" fill="${color}"/>` +
    `<ellipse cx="0" cy="-30" rx="46" ry="36" fill="${color}"/>` +
    `<circle cx="38" cy="-66" r="22" fill="${color}"/>` +
    `<path d="M30 -86c2 -12 12 -12 12 -2c6 -8 14 -2 8 8z" fill="#c9483f"/>` +
    `<path d="M58 -66l18 6l-18 6z" fill="#f4c542"/><circle cx="44" cy="-70" r="3.5" fill="#2a2522" stroke="none"/>` +
    `<path d="M-22 -34q18 22 40 0" fill="none"/></g></g>`
  );
}

function egg(x: number, y: number, item: string): string {
  const fill = item.includes('roux') ? '#d9a06a' : '#fbf1dc';
  return `<ellipse cx="${String(x)}" cy="${String(y)}" rx="13" ry="17" fill="${fill}" ${K}/>`;
}

/** La scène dessinée (provisoire): l'abri en coupe, le grain à son niveau, les œufs, les bêtes. */
export function sceneMarkup(view: ShelterView): string {
  let boards = '';
  for (let i = 0; i < 9; i++)
    boards += `<path d="M${String(150 + i * 120)} 250v330" stroke="#b98b55" stroke-width="3"/>`;
  // Trémie: le grain monte de 0 à 84 px selon la part remplie.
  const h = Math.round(84 * view.feeder.fill);
  const top = 414 - h;
  const inset = (14 * h) / 84;
  const grain =
    h === 0
      ? ''
      : `<path d="M${String(262 - inset)} ${String(top)}h${String(76 + 2 * inset)}l${String(-inset)} ${String(h)}h-76z" fill="#e2b84a" stroke="none"/>` +
        `<path d="M228 506q72 -26 144 0z" fill="#e2b84a" ${K}/>`;
  const items = view.nest.items.flatMap((stack) =>
    Array.from({ length: stack.count }, () => stack.item),
  );
  let eggs = '';
  let k = 0;
  view.nest.boxes.forEach((n, box) => {
    const cx = 985 + box * 90;
    for (let i = 0; i < n; i++, k++)
      eggs += egg(cx - 14 + ((i * 17) % 40), 474 - Math.floor(i / 3) * 12, items[k] ?? 'oeuf');
  });
  const hens = view.animals
    .map((animal, i) =>
      hen(
        animalX(i, view.animals.length),
        FLOOR.y - (i % 2) * 20,
        animal.color,
        i % 2 === 1,
        animal.id,
      ),
    )
    .join('');
  return (
    `<svg class="lpl-coop-scene" viewBox="0 0 1366 768" aria-hidden="true">` +
    `<rect width="1366" height="768" fill="#a9d3e6"/><path d="M0 330q340 -50 700 -16t666 -24V768H0z" fill="#9cba6a"/>` +
    `<g ${K}>` +
    `<path d="M84 250h1198l-110 -112H194z" fill="#a4463b"/><path d="M194 138h978" fill="none" stroke-width="8"/>` +
    `<path d="M110 250h1146v340H110z" fill="#d3a66d"/>${boards}` +
    `<path d="M70 590h1226l40 110H30z" fill="#e8cf8a"/>` +
    `<path d="M110 250v340l-40 0v-300zM1256 250v340l40 0v-300z" fill="#a97749"/>` +
    `<rect x="560" y="290" width="150" height="110" rx="8" fill="#bfe0ee"/><path d="M635 290v110M560 345h150" fill="none"/>` +
    `<path d="M236 300h128l-22 130h-84z" fill="#fbf6e9" fill-opacity=".75"/>${grain}` +
    `<path d="M236 300h128l-22 130h-84z" fill="none"/><rect x="226" y="286" width="148" height="18" rx="6" fill="#765130"/>` +
    `<path d="M200 506h200l-16 44H216z" fill="#765130"/>` +
    `<path d="M940 380h270v130H940z" fill="#8a5a33"/><path d="M1030 380v130M1120 380v130" fill="none"/>` +
    `<path d="M948 496q36 -34 74 0zM1038 496q36 -34 74 0zM1128 496q36 -34 74 0z" fill="#e8cf8a"/>${eggs}` +
    `<path d="M930 510h290v22H930z" fill="#765130"/><path d="M950 532v60M1200 532v60" stroke-width="10" stroke="#765130"/>` +
    `</g>` +
    `<g stroke="#c9a94e" stroke-width="3" fill="none"><path d="M180 640l40 -10M420 660l50 6M700 630l44 -8M930 664l50 -6M1150 640l40 8M560 690l40 -6"/></g>` +
    hens +
    `</svg>`
  );
}

/** Position d'une zone dans la scène, en % de la scène (pastilles, anneau de focus, bulle). */
function zoneAt(model: CoopModel): { x: number; y: number; r: number } {
  const { focus, view } = model;
  if (focus.kind === 'feeder') return { x: FEEDER.x, y: 440, r: 95 };
  if (focus.kind === 'nest') return { x: NEST.x, y: 450, r: 150 };
  const index = view.animals.findIndex((animal) => animal.id === focus.animal);
  return { x: animalX(index, view.animals.length), y: FLOOR.y - 40 - (index % 2) * 20, r: 85 };
}

const pct = (value: number, of: number): string => `${((100 * value) / of).toFixed(2)}%`;

function card(animal: AnimalView, focused: boolean): string {
  const hungry = animal.mood === 'hungry';
  const label = COOP_TEXTS.aria.animal(
    animal.name,
    animal.hearts,
    animal.maxHearts,
    animal.laidToday,
    hungry,
  );
  return (
    `<div class="lpl-coop-card${focused ? ' sel' : ''}" role="listitem" aria-label="${label}">` +
    `<span class="lpl-coop-face" style="--robe:${animal.color}">${picto('poule')}</span>` +
    `<span class="lpl-coop-name">${animal.name}</span>` +
    `<span class="lpl-coop-hearts">${hearts(animal.hearts, animal.maxHearts)}</span>` +
    (animal.laidToday ? `<span class="lpl-coop-badge">${picto('oeuf')}</span>` : '') +
    (hungry ? `<span class="lpl-coop-badge alert">??</span>` : '') +
    `</div>`
  );
}

export interface CoopScreenView {
  readonly content: Content;
  world(): ReadonlyWorld | null;
  localIndex(): PlayerIndex | null;
}

export interface CoopScreen {
  onEvent(event: GameEvent): void;
  isOpen(): boolean;
  frame(dtMs: number): void;
  dispose(): void;
}

const NAV: Readonly<Record<string, number>> = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };

export function createCoopScreen(
  layer: HTMLElement,
  view: CoopScreenView,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  keyTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  openGuardMs = 250,
): CoopScreen {
  const root = document.createElement('div');
  root.className = 'lpl-coop';
  root.hidden = true;
  layer.append(root);

  let target: string | null = null;
  let index = 0;
  let now = 0;
  let openedAt = 0;
  /** Dernier geste: cœur qui monte, picorage, œufs qui volent (rejoué par la classe). */
  let flash: { kind: 'pet' | 'fill' | 'collect' | 'refused'; at: number; animal: number } | null =
    null;
  let lastHtml = '';

  function model(): CoopModel | null {
    const world = view.world();
    const me = view.localIndex();
    if (target === null || world === null || me === null) return null;
    return coopModel({ content: view.content, world }, me, target, index);
  }

  function render(): void {
    const m = target === null ? null : model();
    root.hidden = m === null;
    if (m === null) {
      lastHtml = '';
      return;
    }
    const { view: shelter } = m;
    const z = zoneAt(m);
    const verb = COOP_TEXTS.verbs[m.gesture];
    const icon = m.gesture === 'fill' ? 'grain' : m.gesture === 'collect' ? 'oeuf' : 'coeur';
    const days = shelter.feeder.days;
    const empty = shelter.feeder.level === 'empty';
    const free = Math.max(0, shelter.places - shelter.animals.length);
    const fresh = flash !== null && now - flash.at < 1200 ? flash : null;
    const focusedAnimal = m.focus.kind === 'animal' ? m.focus.animal : -1;
    const emotes = shelter.animals
      .map((animal, i) => {
        if (animal.mood !== 'hungry') return '';
        const x = animalX(i, shelter.animals.length);
        return `<div class="lpl-coop-emote" style="left:${pct(x + 30, 1366)};top:${pct(FLOOR.y - 130 - (i % 2) * 20, 768)}">${animal.sound}</div>`;
      })
      .join('');
    const heart =
      fresh?.kind === 'pet'
        ? `<div class="lpl-coop-heartup" style="left:${pct(z.x, 1366)};top:${pct(z.y - 110, 768)}">${picto('coeur')}</div>`
        : '';
    const html =
      `<div class="lpl-coop-stage${fresh?.kind === 'fill' ? ' peck' : ''}${fresh?.kind === 'collect' ? ' fly' : ''}">` +
      sceneMarkup(shelter) +
      `<div class="lpl-coop-ring" style="left:${pct(z.x, 1366)};top:${pct(z.y, 768)};width:${pct(2 * z.r, 1366)}"></div>` +
      `<button class="lpl-coop-zone${empty ? ' alert' : ''}" style="left:${pct(FEEDER.x, 1366)};top:${pct(272, 768)}" aria-label="${COOP_TEXTS.aria.feeder(days)}">` +
      `<span class="lpl-coop-gauge${shelter.feeder.level === 'low' ? ' low' : ''}" style="--val:${String(Math.round(shelter.feeder.fill * 100))}">${picto('grain')}</span>` +
      `${days === null ? '' : `${String(days)} <small>${COOP_TEXTS.days(days)}</small>`}</button>` +
      `<button class="lpl-coop-zone egg${shelter.nest.count === 0 ? ' none' : ''}${shelter.nest.full ? ' alert' : ''}" style="left:${pct(NEST.x, 1366)};top:${pct(300, 768)}" aria-label="${COOP_TEXTS.aria.nest(shelter.nest.count)}">` +
      `${picto('oeuf')}${String(shelter.nest.count)}${shelter.nest.full ? ' <b>!!</b>' : ''}</button>` +
      emotes +
      heart +
      `<div class="lpl-coop-prompt${m.refusal === null ? '' : ' off'}${fresh?.kind === 'refused' ? ' shake' : ''}" style="left:${pct(z.x, 1366)};top:${pct(m.focus.kind === 'feeder' ? 338 : z.y - z.r * 0.7, 768)}">` +
      `<span class="key">${keyLabel('Space')}</span><span class="lpl-coop-pi">${picto(icon)}${m.refusal === null ? '' : picto('barre', 'bar')}</span>${verb}</div>` +
      `</div>` +
      `<div class="lpl-coop-keys"><span><span class="key">${keyLabel('KeyA')}</span><span class="key">${keyLabel('KeyD')}</span> ${COOP_TEXTS.neighbour}</span>` +
      `<span><span class="key">${keyLabel('Backspace')}</span>${picto('sortie')}</span></div>` +
      `<div class="lpl-coop-cards" role="list" aria-label="${COOP_TEXTS.aria.list}">` +
      shelter.animals.map((animal) => card(animal, animal.id === focusedAnimal)).join('') +
      Array.from(
        { length: free },
        () =>
          `<div class="lpl-coop-card free" role="listitem" aria-label="${COOP_TEXTS.aria.free}">${picto('plus')}</div>`,
      ).join('') +
      `</div>` +
      `<div class="provisoire lpl-coop-prov">${COOP_TEXTS.provisional}</div>`;
    if (html !== lastHtml) {
      root.innerHTML = html;
      lastHtml = html;
    }
  }

  function close(): void {
    target = null;
    flash = null;
    render();
  }

  function act(): void {
    const m = model();
    if (m === null || target === null) return;
    if (m.refusal !== null) {
      flash = { kind: 'refused', at: now, animal: -1 };
      return;
    }
    if (m.focus.kind === 'feeder') send({ type: 'shelter_fill', target });
    else if (m.focus.kind === 'nest') send({ type: 'shelter_collect', target });
    else send({ type: 'animal_pet', target, animal: m.focus.animal });
  }

  const onDown = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent) || target === null) return;
    const step = NAV[raw.code];
    if (step !== undefined) {
      const m = model();
      if (m !== null) index = Math.max(0, Math.min(m.zones.length - 1, m.index + step));
    } else if (raw.code === 'Space' || raw.code === 'Enter') {
      if (!raw.repeat && now - openedAt >= openGuardMs) act();
    } else if (raw.code === 'Backspace' || raw.code === 'Escape') close();
    else return;
    raw.preventDefault();
    raw.stopImmediatePropagation();
    render();
  };
  keyTarget.addEventListener('keydown', onDown);

  return {
    onEvent(event) {
      const me = view.localIndex();
      if (me === null) return;
      if (event.type === 'shelter_opened') {
        if (event.player !== me) return;
        target = event.target;
        index = 0;
        openedAt = now;
      } else if (target === null || !('target' in event) || event.target !== target) return;
      else if (event.type === 'shelter_filled') flash = { kind: 'fill', at: now, animal: -1 };
      else if (event.type === 'shelter_collected') flash = { kind: 'collect', at: now, animal: -1 };
      else if (event.type === 'animal_petted')
        flash = { kind: 'pet', at: now, animal: event.animal };
      else if (event.type === 'refused' && event.player === me)
        flash = { kind: 'refused', at: now, animal: -1 };
    },
    isOpen() {
      return target !== null;
    },
    frame(dtMs) {
      now += dtMs;
      render();
    },
    dispose() {
      keyTarget.removeEventListener('keydown', onDown);
      root.remove();
    },
  };
}
