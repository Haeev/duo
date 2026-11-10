/**
 * Mode déco (interface.md 5.7): vue du dessus du logement, inventaire à gauche, meubles glissés à
 * la souris et aimantés à la grille, aperçu vert ou hachuré rouge avec la raison en un picto,
 * rotation à la molette ou aux touches, clic droit pour ranger. Tout se fait aussi au clavier.
 * Le meuble tenu par l'autre joueur porte son liseré et son jeton; son geste se voit en direct.
 *
 * Le plan est dessiné ici sur un canevas (formes simples). Quand le rendu fournira une caméra du
 * dessus (`DecoOptions.topView`), le canevas ne dessinera plus que les aperçus par-dessus la 3D.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { HousingDef } from '../../donnees/schemas/logement';
import type { Hold } from '../../etat/logement';
import type { ReadonlyWorld } from '../../etat/monde';
import { comfortLevel, housingAt } from '../../simulation/logement/etat';
import {
  boxOf,
  decoOf,
  placementRefusal,
  propsOnTop,
  roomState,
  snapCandidate,
  type Box,
  type Candidate,
  type PlacementRefusal,
} from '../../simulation/logement/pose';
import { HOUSING_TUNING } from '../../simulation/logement/reglages';
import type { Intent } from '../../simulation/noyau/entrees';
import { decoPicto } from './pictos';
import { DECO_TEXTS, REASON_TEXTS } from './textes';
import './deco.css';

/** Projection monde (m) vers écran (px CSS), et retour, fournie par le rendu en vue du dessus. */
export interface TopView {
  toScreen(x: number, y: number): { x: number; y: number };
  toWorld(px: number, py: number): { x: number; y: number };
  pixelsPerMeter(): number;
}

export interface DecoOptions {
  readonly layer: HTMLElement;
  readonly content: Content;
  readonly world: () => ReadonlyWorld | null;
  readonly localIndex: () => PlayerIndex | null;
  readonly send: (intent: Intent) => void;
  readonly keyLabel: (code: string) => string;
  /** Caméra du dessus du rendu; absente: le plan est dessiné ici. */
  readonly topView?: (housing: HousingDef) => TopView | null;
}

export interface DecoMode {
  open(housing: string): void;
  close(): void;
  isOpen(): boolean;
  key(code: string): boolean;
  frame(): void;
  dispose(): void;
}

const COLORS = {
  paper: '#f3ebd4',
  ruin: '#c9b897',
  wall: '#5c3d24',
  garden: '#9dbb6e',
  prop: '#b98a55',
  rug: '#c98f86',
  top: '#e8c77a',
  wallItem: '#3f6453',
  ink: '#2a2522',
  ok: '#3f6453',
  bad: '#a4463b',
  me: '#5ce1e6',
  other: '#8d6cff',
} as const;

function fill(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? '');
}

export function createDecoMode(options: DecoOptions): DecoMode {
  const { content, send } = options;
  const root = document.createElement('div');
  root.className = 'lpl-deco';
  root.hidden = true;
  root.innerHTML = `
    <aside class="lpl-deco__stock"><h2></h2><ul></ul><p class="lpl-deco__comfort"></p></aside>
    <div class="lpl-deco__plan"><canvas></canvas><div class="lpl-deco__badge" hidden></div></div>
    <footer class="lpl-deco__bar">
      <button type="button" data-act="rotate"></button>
      <button type="button" data-act="store"></button>
      <button type="button" data-act="exit"></button>
      <span class="lpl-deco__keys"></span>
    </footer>`;
  options.layer.append(root);
  function q<T extends Element>(sel: string, kind: new () => T): T {
    const el = root.querySelector(sel);
    if (!(el instanceof kind)) throw new Error(`mode déco: ${sel} absent`);
    return el;
  }
  const canvas = q('canvas', HTMLCanvasElement);
  const plan = q('.lpl-deco__plan', HTMLDivElement);
  const badge = q('.lpl-deco__badge', HTMLDivElement);
  const list = q('.lpl-deco__stock ul', HTMLUListElement);
  const comfortEl = q('.lpl-deco__comfort', HTMLParagraphElement);
  q('.lpl-deco__stock h2', HTMLHeadingElement).textContent = DECO_TEXTS.stock;
  q('[data-act=rotate]', HTMLButtonElement).textContent = DECO_TEXTS.rotate;
  q('[data-act=store]', HTMLButtonElement).textContent = DECO_TEXTS.store;
  q('[data-act=exit]', HTMLButtonElement).textContent = DECO_TEXTS.exit;
  const k = options.keyLabel;
  q('.lpl-deco__keys', HTMLSpanElement).textContent = fill(DECO_TEXTS.keys, {
    w: k('KeyZ'),
    x: k('KeyX'),
    tab: k('Tab'),
    a: k('KeyQ'),
    e: k('KeyE'),
    entree: k('Enter'),
    espace: k('Space'),
    retour: k('Backspace'),
  });
  const ctx2d = canvas.getContext('2d');

  let housingId: string | null = null;
  /** Position voulue du meuble en main (locale, en avance sur l'état reçu). */
  let local: Candidate | null = null;
  let dragging = false;
  let lastSent = 0;
  let stockIndex = 0;
  let selected: string | null = null;
  let stockKey = '';
  let view: TopView | null = null;

  function housing(): { def: HousingDef; world: ReadonlyWorld; me: PlayerIndex } | null {
    const world = options.world();
    const me = options.localIndex();
    const def =
      housingId === null
        ? undefined
        : content.places[world?.common.place ?? '']?.housings[housingId];
    if (world === null || me === null || def === undefined) return null;
    return { def, world, me };
  }

  function hstate(world: ReadonlyWorld, def: HousingDef) {
    return world.places[world.common.place]?.housing?.[def.id];
  }

  function stockTypes(world: ReadonlyWorld, def: HousingDef): [string, number][] {
    return Object.entries(hstate(world, def)?.stock ?? {}).sort(([a], [b]) => a.localeCompare(b));
  }

  /** Projection par défaut: le logement entier dans le canevas, marges comprises. */
  function fitView(def: HousingDef): TopView {
    const boxes = def.rooms.map((r) => r.area);
    if (def.garden !== null) boxes.push(def.garden);
    const x0 = Math.min(...boxes.map((b) => b.x)) - 1;
    const y0 = Math.min(...boxes.map((b) => b.y)) - 1;
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 1;
    const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 1;
    const w = plan.clientWidth;
    const h = plan.clientHeight;
    const ppm = Math.min(w / (x1 - x0), h / (y1 - y0));
    const ox = (w - ppm * (x1 - x0)) / 2;
    const oy = (h - ppm * (y1 - y0)) / 2;
    return {
      toScreen: (x, y) => ({ x: ox + (x - x0) * ppm, y: oy + (y - y0) * ppm }),
      toWorld: (px, py) => ({ x: (px - ox) / ppm + x0, y: (py - oy) / ppm + y0 }),
      pixelsPerMeter: () => ppm,
    };
  }

  function sendMove(now: number, force: boolean): void {
    if (local === null || housingId === null) return;
    if (!force && now - lastSent < HOUSING_TUNING.dragSendMs) return;
    lastSent = now;
    send({
      type: 'deco_move',
      housing: housingId,
      x: local.x,
      y: local.y,
      rotation: local.rotation,
    });
  }

  function myHold(): Hold | null {
    const h = housing();
    if (h === null) return null;
    return hstate(h.world, h.def)?.held[h.me] ?? null;
  }

  function placedAt(x: number, y: number): string | null {
    const h = housing();
    if (h === null) return null;
    const placed = h.world.places[h.world.common.place]?.placed ?? [];
    // Le plus haut d'abord: mur, dessus, sol, tapis.
    const order = ['wall', 'top', 'floor', 'rug'];
    let best: { id: string; rank: number } | null = null;
    for (const p of placed) {
      const def = content.props[p.type];
      if (def === undefined) continue;
      const b = boxOf(def, p);
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      const rank = order.indexOf(decoOf(def).layer);
      if (best === null || rank < best.rank) best = { id: p.id, rank };
    }
    return best?.id ?? null;
  }

  function preview(c: Candidate): PlacementRefusal | null {
    const h = housing();
    if (h === null) return 'outside';
    const place = content.places[h.world.common.place];
    const state = h.world.places[h.world.common.place];
    if (place === undefined || state === undefined) return 'outside';
    const hold = myHold();
    const exclude = new Set<string>();
    if (hold !== null && hold.prop !== null) {
      exclude.add(hold.prop);
      const p = state.placed.find((x) => x.id === hold.prop);
      if (p !== undefined) for (const t of propsOnTop(content, state, p)) exclude.add(t.id);
    }
    return placementRefusal({ content, place, state, housing: h.def, candidate: c, exclude });
  }

  function worldAt(ev: MouseEvent): { x: number; y: number } | null {
    if (view === null) return null;
    const r = canvas.getBoundingClientRect();
    return view.toWorld(ev.clientX - r.left, ev.clientY - r.top);
  }

  function rotate(): void {
    if (local === null) return;
    local = snapCandidate(content, {
      ...local,
      rotation: ((local.rotation + 1) % 4) as 0 | 1 | 2 | 3,
    });
    sendMove(performance.now(), true);
  }

  function drop(): void {
    if (housingId === null || local === null) return;
    sendMove(performance.now(), true);
    send({ type: 'deco_drop', housing: housingId });
    dragging = false;
  }

  function grab(id: string): void {
    const h = housing();
    if (h === null || housingId === null) return;
    const p = h.world.places[h.world.common.place]?.placed.find((x) => x.id === id);
    const other = hstate(h.world, h.def)?.held[h.me === 0 ? 1 : 0];
    if (p === undefined || other?.prop === id) return;
    send({ type: 'deco_grab', housing: housingId, prop: id });
    local = { type: p.type, x: p.x, y: p.y, rotation: p.rotation };
    selected = id;
  }

  function take(type: string, x: number, y: number): void {
    if (housingId === null || myHold() !== null) return;
    local = snapCandidate(content, { type, x, y, rotation: 0 });
    send({
      type: 'deco_take',
      housing: housingId,
      prop: type,
      x: local.x,
      y: local.y,
      rotation: 0,
    });
  }

  function store(id: string | null): void {
    if (housingId === null) return;
    send({ type: 'deco_store', housing: housingId, prop: id });
    local = null;
    dragging = false;
  }

  const onDown = (ev: MouseEvent): void => {
    const at = worldAt(ev);
    if (at === null) return;
    ev.preventDefault();
    if (ev.button === 2) {
      store(myHold() !== null ? null : placedAt(at.x, at.y));
      return;
    }
    if (ev.button !== 0) return;
    if (myHold() !== null || local !== null) {
      drop();
      return;
    }
    const id = placedAt(at.x, at.y);
    if (id !== null) {
      grab(id);
      dragging = true;
    }
  };
  const onMove = (ev: MouseEvent): void => {
    const at = worldAt(ev);
    if (at === null || local === null) return;
    local = snapCandidate(content, { ...local, x: at.x, y: at.y });
    sendMove(performance.now(), false);
  };
  const onUp = (ev: MouseEvent): void => {
    if (ev.button === 0 && dragging) drop();
  };
  const onWheel = (ev: WheelEvent): void => {
    if (local === null) return;
    ev.preventDefault();
    rotate();
  };
  const noMenu = (ev: Event): void => {
    ev.preventDefault();
  };
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', noMenu);
  root.addEventListener('click', (ev) => {
    const target =
      ev.target instanceof Element
        ? ev.target.closest<HTMLElement>('[data-act],[data-prop]')
        : null;
    if (target === null) return;
    const act = target.dataset.act;
    if (act === 'rotate') rotate();
    else if (act === 'store') store(myHold() !== null ? null : selected);
    else if (act === 'exit') mode.close();
    else if (target.dataset.prop !== undefined) takeCentered(target.dataset.prop);
  });

  function takeCentered(type: string): void {
    const h = housing();
    if (h === null) return;
    const room =
      h.def.rooms.find((r) => roomState(r, hstate(h.world, h.def)) === 'restored') ??
      h.def.rooms[0];
    if (room === undefined) return;
    take(type, room.area.x + room.area.w / 2, room.area.y + room.area.h / 2);
  }

  function cycleSelection(): void {
    const h = housing();
    if (h === null) return;
    const ids = (h.world.places[h.world.common.place]?.placed ?? [])
      .filter((p) => {
        const def = content.props[p.type];
        if (def === undefined) return false;
        const b = boxOf(def, p);
        return (
          h.def.rooms.some(
            (r) =>
              b.x0 >= r.area.x &&
              b.x1 <= r.area.x + r.area.w &&
              b.y0 >= r.area.y &&
              b.y1 <= r.area.y + r.area.h,
          ) ||
          (h.def.garden !== null &&
            b.x0 >= h.def.garden.x &&
            b.x1 <= h.def.garden.x + h.def.garden.w &&
            b.y0 >= h.def.garden.y &&
            b.y1 <= h.def.garden.y + h.def.garden.h)
        );
      })
      .map((p) => p.id);
    if (ids.length === 0) return;
    const i = selected === null ? -1 : ids.indexOf(selected);
    selected = ids[(i + 1) % ids.length] ?? null;
  }

  function renderStock(world: ReadonlyWorld, def: HousingDef): void {
    const types = stockTypes(world, def);
    const level = hstate(world, def)?.level ?? 0;
    const keyText = `${types.map(([t, n]) => `${t}:${String(n)}`).join(',')}|${String(stockIndex)}|${String(level)}`;
    if (keyText === stockKey) return;
    stockKey = keyText;
    list.innerHTML =
      types.length === 0
        ? `<li class="lpl-deco__empty">${DECO_TEXTS.empty}</li>`
        : types
            .map(([type, n], i) => {
              const prop = content.props[type];
              const series = prop?.series ?? '';
              return `<li><button type="button" data-prop="${type}" data-series="${series}" class="${i === stockIndex ? 'is-focus' : ''}"><span class="lpl-deco__swatch" data-layer="${prop === undefined ? 'floor' : decoOf(prop).layer}"></span>${prop?.name ?? type}<b>${String(n)}</b></button></li>`;
            })
            .join('');
    const label = DECO_TEXTS.levels[Math.min(level, DECO_TEXTS.levels.length - 1)] ?? '';
    comfortEl.innerHTML = `${DECO_TEXTS.comfort}: <b>${label}</b> <span aria-hidden="true">${'●'.repeat(level)}${'○'.repeat(Math.max(0, HOUSING_TUNING.comfort.tiers.length - level))}</span>`;
  }

  function rectPath(v: TopView, b: Box): { x: number; y: number; w: number; h: number } {
    const a = v.toScreen(b.x0, b.y0);
    const z = v.toScreen(b.x1, b.y1);
    return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  }

  function hatch(
    c: CanvasRenderingContext2D,
    r: { x: number; y: number; w: number; h: number },
    color: string,
  ): void {
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.strokeStyle = color;
    c.lineWidth = 2;
    for (let s = -r.h; s < r.w; s += 8) {
      c.beginPath();
      c.moveTo(r.x + s, r.y + r.h);
      c.lineTo(r.x + s + r.h, r.y);
      c.stroke();
    }
    c.restore();
  }

  function draw(world: ReadonlyWorld, def: HousingDef, me: PlayerIndex): void {
    if (ctx2d === null) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = plan.clientWidth;
    const h = plan.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const c = ctx2d;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const external = options.topView?.(def) ?? null;
    const v = external ?? fitView(def);
    view = v;
    const ppm = v.pixelsPerMeter();
    const place = content.places[world.common.place];
    const state = world.places[world.common.place];
    const hs = hstate(world, def);
    if (place === undefined || state === undefined) return;
    if (external === null) {
      // Jardin, pièces, murs: le plan du logement.
      if (def.garden !== null) {
        const g = rectPath(v, {
          x0: def.garden.x,
          y0: def.garden.y,
          x1: def.garden.x + def.garden.w,
          y1: def.garden.y + def.garden.h,
        });
        c.fillStyle = COLORS.garden;
        c.fillRect(g.x, g.y, g.w, g.h);
        c.setLineDash([6, 5]);
        c.strokeStyle = COLORS.ink;
        c.lineWidth = 1.5;
        c.strokeRect(g.x, g.y, g.w, g.h);
        c.setLineDash([]);
      }
      for (const room of def.rooms) {
        const s = roomState(room, hs);
        if (s === 'absent') continue;
        const r = rectPath(v, {
          x0: room.area.x,
          y0: room.area.y,
          x1: room.area.x + room.area.w,
          y1: room.area.y + room.area.h,
        });
        c.fillStyle = s === 'restored' ? COLORS.paper : COLORS.ruin;
        c.fillRect(r.x, r.y, r.w, r.h);
        if (s !== 'restored') hatch(c, r, 'rgba(92,61,36,0.35)');
        c.fillStyle = COLORS.ink;
        c.font = `600 ${String(Math.max(11, ppm * 0.4))}px system-ui, sans-serif`;
        c.fillText(room.name, r.x + 6, r.y + r.h - 6);
      }
      c.fillStyle = COLORS.wall;
      for (const b of place.map.blocked) {
        const r = rectPath(v, { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h });
        c.fillRect(r.x, r.y, r.w, r.h);
      }
      // Seuils des portes: le passage dans le mur, et la zone à laisser libre en pointillé.
      const clear = HOUSING_TUNING.doorClearance;
      for (const d of [def.entrance, ...def.doors]) {
        const s = rectPath(v, { x0: d.x - 0.5, y0: d.y - 0.5, x1: d.x + 0.5, y1: d.y + 0.5 });
        c.fillStyle = COLORS.paper;
        c.fillRect(s.x, s.y, s.w, s.h);
        const z = rectPath(v, {
          x0: d.x - clear,
          y0: d.y - clear,
          x1: d.x + clear,
          y1: d.y + clear,
        });
        c.setLineDash([3, 4]);
        c.strokeStyle = COLORS.wall;
        c.lineWidth = 1;
        c.strokeRect(z.x, z.y, z.w, z.h);
        c.setLineDash([]);
      }
      // Meubles posés, du tapis au mur.
      const layers = ['rug', 'floor', 'top', 'wall'] as const;
      for (const layer of layers) {
        for (const p of [...place.map.objects, ...state.placed]) {
          const pd = content.props[p.type];
          if (pd === undefined || decoOf(pd).layer !== layer) continue;
          const r = rectPath(v, boxOf(pd, p));
          const inset = layer === 'top' ? ppm * 0.15 : layer === 'wall' ? 0 : 1;
          const rr =
            layer === 'wall'
              ? wallStrip(r, p.rotation, ppm)
              : { x: r.x + inset, y: r.y + inset, w: r.w - inset * 2, h: r.h - inset * 2 };
          c.fillStyle =
            layer === 'rug'
              ? COLORS.rug
              : layer === 'top'
                ? COLORS.top
                : layer === 'wall'
                  ? COLORS.wallItem
                  : COLORS.prop;
          c.fillRect(rr.x, rr.y, rr.w, rr.h);
          c.strokeStyle = COLORS.ink;
          c.lineWidth = selected === p.id ? 3 : 1;
          c.strokeRect(rr.x, rr.y, rr.w, rr.h);
          // Façade: un trait épais du côté où l'on s'en sert.
          facade(c, rr, p.rotation);
          if (layer !== 'wall' && layer !== 'rug' && r.w > 40) {
            c.fillStyle = COLORS.ink;
            c.font = `500 ${String(Math.max(10, ppm * 0.28))}px system-ui, sans-serif`;
            c.fillText(pd.name, rr.x + 4, rr.y + Math.max(12, ppm * 0.32), rr.w - 8);
          }
        }
      }
    }
    // Les meubles en main: l'autre (liseré et jeton à sa couleur), puis le mien (vert ou hachuré rouge).
    const other: PlayerIndex = me === 0 ? 1 : 0;
    const theirs = hs?.held[other] ?? null;
    if (theirs !== null) ghost(c, v, theirs, COLORS.other, null, world.players[other].name);
    const mine = hs?.held[me] ?? null;
    if (mine === null && !dragging) local = null;
    const shown = local ?? mine;
    badge.hidden = true;
    if (shown !== null) {
      const reason = preview(shown);
      ghost(c, v, shown, reason === null ? COLORS.ok : COLORS.bad, reason, null);
    }
  }

  function wallStrip(
    r: { x: number; y: number; w: number; h: number },
    rotation: number,
    ppm: number,
  ) {
    const t = Math.max(4, ppm * 0.18);
    if (rotation === 0) return { x: r.x + 3, y: r.y, w: r.w - 6, h: t };
    if (rotation === 1) return { x: r.x, y: r.y + 3, w: t, h: r.h - 6 };
    if (rotation === 2) return { x: r.x + 3, y: r.y + r.h - t, w: r.w - 6, h: t };
    return { x: r.x + r.w - t, y: r.y + 3, w: t, h: r.h - 6 };
  }

  function facade(
    c: CanvasRenderingContext2D,
    r: { x: number; y: number; w: number; h: number },
    rotation: number,
  ): void {
    c.beginPath();
    if (rotation === 0) {
      c.moveTo(r.x, r.y + r.h);
      c.lineTo(r.x + r.w, r.y + r.h);
    } else if (rotation === 1) {
      c.moveTo(r.x + r.w, r.y);
      c.lineTo(r.x + r.w, r.y + r.h);
    } else if (rotation === 2) {
      c.moveTo(r.x, r.y);
      c.lineTo(r.x + r.w, r.y);
    } else {
      c.moveTo(r.x, r.y);
      c.lineTo(r.x, r.y + r.h);
    }
    c.lineWidth = 3;
    c.strokeStyle = COLORS.ink;
    c.stroke();
  }

  function ghost(
    c: CanvasRenderingContext2D,
    v: TopView,
    hold: Candidate,
    color: string,
    reason: PlacementRefusal | null,
    owner: string | null,
  ): void {
    const pd = content.props[hold.type];
    if (pd === undefined) return;
    const r = rectPath(v, boxOf(pd, hold));
    c.save();
    c.globalAlpha = 0.55;
    c.fillStyle = color;
    c.fillRect(r.x, r.y, r.w, r.h);
    c.globalAlpha = 1;
    if (reason !== null) hatch(c, r, COLORS.bad);
    c.lineWidth = 3;
    c.strokeStyle = color;
    if (owner !== null) c.setLineDash([7, 4]);
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.setLineDash([]);
    facade(c, r, hold.rotation);
    c.restore();
    if (owner !== null) {
      // Jeton de l'autre joueur: son initiale dans un rond à sa couleur.
      c.fillStyle = COLORS.other;
      c.beginPath();
      c.arc(r.x + r.w, r.y, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fbf6e9';
      c.font = '700 13px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(owner.slice(0, 1).toUpperCase(), r.x + r.w, r.y + 4.5);
      c.textAlign = 'start';
      return;
    }
    const label = reason === null ? DECO_TEXTS.ok : REASON_TEXTS[reason];
    badge.hidden = false;
    badge.dataset.ok = reason === null ? 'oui' : 'non';
    badge.innerHTML = `${decoPicto(reason ?? 'ok', label)}<span>${label}</span>`;
    badge.style.transform = `translate(${String(Math.round(r.x + r.w + 8))}px, ${String(Math.round(r.y - 8))}px)`;
  }

  const mode: DecoMode = {
    open(id) {
      housingId = id;
      root.hidden = false;
      stockKey = '';
      send({ type: 'deco_mode', housing: id, on: true });
    },
    close() {
      if (housingId !== null) send({ type: 'deco_mode', housing: housingId, on: false });
      housingId = null;
      local = null;
      dragging = false;
      root.hidden = true;
    },
    isOpen() {
      return housingId !== null;
    },
    key(code) {
      if (housingId === null) return false;
      const h = housing();
      if (h === null) return false;
      const types = stockTypes(h.world, h.def);
      const step = HOUSING_TUNING.gridStep;
      const nudge = (dx: number, dy: number): void => {
        if (local === null) return;
        local = snapCandidate(content, { ...local, x: local.x + dx, y: local.y + dy });
        sendMove(performance.now(), true);
      };
      switch (code) {
        case 'Backspace':
        case 'KeyB':
          mode.close();
          return true;
        case 'KeyZ':
        case 'KeyX':
          rotate();
          return true;
        case 'KeyQ':
          stockIndex = (stockIndex + types.length - 1) % Math.max(1, types.length);
          return true;
        case 'KeyE':
          stockIndex = (stockIndex + 1) % Math.max(1, types.length);
          return true;
        case 'Enter': {
          const type = types[stockIndex]?.[0];
          if (type !== undefined) takeCentered(type);
          return true;
        }
        case 'Tab':
          if (local === null) cycleSelection();
          return true;
        case 'Space':
          if (local !== null) drop();
          else if (selected !== null) grab(selected);
          return true;
        case 'Delete':
          store(local !== null ? null : selected);
          return true;
        case 'ArrowUp':
        case 'KeyW':
          nudge(0, -step);
          return true;
        case 'ArrowDown':
        case 'KeyS':
          nudge(0, step);
          return true;
        case 'ArrowLeft':
        case 'KeyA':
          nudge(-step, 0);
          return true;
        case 'ArrowRight':
        case 'KeyD':
          nudge(step, 0);
          return true;
        default:
          return false;
      }
    },
    frame() {
      const h = housing();
      if (h === null) return;
      renderStock(h.world, h.def);
      draw(h.world, h.def, h.me);
      const level = hstate(h.world, h.def)?.level ?? comfortLevel(0);
      root.dataset.level = String(level);
    },
    dispose() {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
      root.remove();
    },
  };
  return mode;
}

/** Le logement où se tient ce joueur (pièce ou jardin), `null`: pas chez lui. */
export function decoHousingFor(
  content: Content,
  world: ReadonlyWorld | null,
  player: PlayerIndex | null,
): string | null {
  if (world === null || player === null) return null;
  const place = content.places[world.common.place];
  const state = world.places[world.common.place];
  if (place === undefined || state === undefined) return null;
  const { x, y } = world.players[player].body;
  return housingAt(place, state, x, y)?.id ?? null;
}
