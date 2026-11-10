/**
 * Onglet Carte (interface.md, 5.3): une carte dessinée du lieu, générée depuis ses données de plan
 * (routes, eau, voie ferrée, bâtiments, repères, zones encore fermées en grisé), avec les deux
 * joueurs, les habitants connus et la cible de la quête suivie. Un curseur (Z Q S D) saute de lieu
 * en lieu et dit qui s'y trouve. Le modèle (`mapModel`, `nearestPlace`) est pur; `mapSvg` écrit le
 * dessin. Mise à jour des portraits toutes les 2 s (`mapRefreshMs`), pas à chaque image.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { el, icon } from '../dom';
import { hueOf } from '../pictos';
import { fill } from '../textes';
import { CARNET_TUNING } from './parametres';
import type { MapRead } from './lectures';
import { DIRECTION_KEYS, type Direction, type Tab, type TabDeps } from './onglet';
import type { PlanRead } from './plan';
import type { FollowStore } from './quetes';
import type { SharedTabState } from './habitants';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.map;

export interface MapPlaceModel {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly closed: boolean;
  readonly occupants: readonly { readonly id: string; readonly name: string }[];
}

export interface MapModel {
  readonly width: number;
  readonly height: number;
  readonly places: readonly MapPlaceModel[];
  readonly closed: readonly string[];
  readonly night: boolean;
}

/** Point dans un polygone (tir de rayon). */
export function inPolygon(
  x: number,
  y: number,
  poly: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if (a === undefined || b === undefined) continue;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

function closedAt(plan: PlanRead, closed: readonly string[], x: number, y: number): boolean {
  return closed.some((id) => {
    const zone = plan.zones[id];
    return zone !== undefined && inPolygon(x, y, zone.poly);
  });
}

/** Les lieux du curseur : les points clés du plan, avec leurs occupants (habitants connus à moins de `mapPlaceRadius`). */
export function mapModel(read: MapRead, radius: number = CARNET_TUNING.mapPlaceRadius): MapModel {
  const { plan } = read;
  const base = plan.points_cles.flatMap((k) => {
    const node = plan.noeuds[k.noeud];
    return node === undefined ? [] : [{ id: k.noeud, name: k.nom, x: node.x, y: node.y }];
  });
  const occupants = new Map<string, { id: string; name: string }[]>();
  for (const v of read.villagers) {
    let best: (typeof base)[number] | undefined;
    let bestDistance = radius;
    for (const p of base) {
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d <= bestDistance) {
        best = p;
        bestDistance = d;
      }
    }
    if (best !== undefined)
      occupants.set(best.id, [...(occupants.get(best.id) ?? []), { id: v.id, name: v.name }]);
  }
  return {
    width: plan.taille.largeur,
    height: plan.taille.hauteur,
    places: base.map((p) => ({
      ...p,
      closed: closedAt(plan, read.closed, p.x, p.y),
      occupants: occupants.get(p.id) ?? [],
    })),
    closed: read.closed,
    night: read.night,
  };
}

/**
 * Lieu voisin dans une direction : celui qui avance le plus dans la direction demandée sans trop
 * s'écarter de côté. Reste sur place s'il n'y en a pas.
 */
export function nearestPlace(
  places: readonly MapPlaceModel[],
  from: string | null,
  dir: Direction,
): string | null {
  const here = places.find((p) => p.id === from);
  if (here === undefined) return places[0]?.id ?? null;
  const vectors: Readonly<Record<Direction, readonly [number, number]>> = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1],
  };
  const vector = vectors[dir];
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const p of places) {
    if (p.id === here.id) continue;
    const dx = p.x - here.x;
    const dy = p.y - here.y;
    const along = dx * vector[0] + dy * vector[1];
    const side = Math.abs(dx * vector[1] - dy * vector[0]);
    if (along <= 0.5 || side > along * 2) continue;
    const score = along + side * 1.5;
    if (score < bestScore) {
      best = p.id;
      bestScore = score;
    }
  }
  return best ?? here.id;
}

/** Lieu où se tient un habitant ou un joueur (le plus proche), pour poser le curseur. */
export function placeNear(model: MapModel, x: number, y: number): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const p of model.places) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDistance) {
      best = p.id;
      bestDistance = d;
    }
  }
  return best;
}

// ---------- Dessin ----------

const ROAD_WIDTH: Readonly<Record<string, number>> = {
  route: 4,
  rue: 3.2,
  chemin: 2.2,
  sentier: 1.1,
};
const INK = '#2a2522';

function pts(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

function center(poly: readonly (readonly [number, number])[]): [number, number] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

function initial(name: string): string {
  return name.charAt(0).toUpperCase();
}

/** Le fond de carte : tout ce qui vient du plan et ne bouge pas (zones, eau, routes, voie, bâtiments, repères). */
export function baseSvg(plan: PlanRead, closed: readonly string[]): string {
  const out: string[] = [];
  out.push(
    '<defs><pattern id="lpl-gris" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#cfcabd"/><path d="M0 0v3" stroke="#a39d8e" stroke-width="0.7"/></pattern></defs>',
  );
  out.push(`<rect width="${plan.taille.largeur}" height="${plan.taille.hauteur}" fill="#b9c98f"/>`);
  for (const [id, zone] of Object.entries(plan.zones)) {
    const shut = closed.includes(id);
    out.push(
      shut
        ? `<polygon points="${pts(zone.poly)}" fill="url(#lpl-gris)" stroke="#8f897a" stroke-width="0.5" stroke-dasharray="2 1.5"/>`
        : `<polygon points="${pts(zone.poly)}" fill="${zone.couleur}" fill-opacity="0.75" stroke="none"/>`,
    );
  }
  for (const p of plan.parcelles)
    out.push(
      `<rect x="${p.rect[0]}" y="${p.rect[1]}" width="${p.rect[2]}" height="${p.rect[3]}" fill="${p.couleur}" fill-opacity="0.7" stroke="#8a7a45" stroke-width="0.3" stroke-dasharray="1.4 1"/>`,
    );
  for (const w of plan.eaux)
    out.push(
      `<polyline points="${pts(w.pts)}" fill="none" stroke="#5f8ba6" stroke-width="${w.largeur + 1}" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<polyline points="${pts(w.pts)}" fill="none" stroke="#8db6cd" stroke-width="${w.largeur}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  for (const pond of plan.plans_eau)
    out.push(
      `<ellipse cx="${pond.cx}" cy="${pond.cy}" rx="${pond.rx}" ry="${pond.ry}" fill="#8db6cd" stroke="#5f8ba6" stroke-width="0.7"/>`,
    );
  const roads = plan.aretes.flatMap((e) => {
    const a = plan.noeuds[e.a];
    const b = plan.noeuds[e.b];
    const width = ROAD_WIDTH[e.classe];
    return a === undefined || b === undefined || width === undefined
      ? []
      : [{ a, b, width, kind: e.classe }];
  });
  for (const r of roads)
    out.push(
      `<line x1="${r.a.x}" y1="${r.a.y}" x2="${r.b.x}" y2="${r.b.y}" stroke="#9c7b52" stroke-width="${r.width + 0.7}" stroke-linecap="round"/>`,
    );
  for (const r of roads)
    out.push(
      `<line x1="${r.a.x}" y1="${r.a.y}" x2="${r.b.x}" y2="${r.b.y}" stroke="#d9b987" stroke-width="${r.width}" stroke-linecap="round"${r.kind === 'sentier' ? ' stroke-dasharray="2 1.2"' : ''}/>`,
    );
  for (const rail of plan.rails) {
    const dash = rail.tunnel === true ? ' stroke-dasharray="1.5 1.5"' : '';
    out.push(
      `<polyline points="${pts(rail.pts)}" fill="none" stroke="#4a3f36" stroke-width="1.6"${dash}/>`,
      `<polyline points="${pts(rail.pts)}" fill="none" stroke="#e9dfc6" stroke-width="0.9" stroke-dasharray="0.7 1.1"/>`,
    );
  }
  for (const b of plan.batiments) {
    const [x, y, w, h] = b.rect;
    const shut = closedAt(plan, closed, x + w / 2, y + h / 2);
    out.push(
      `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${shut ? '#bdb7aa' : '#bd6e52'}" stroke="${INK}" stroke-width="0.45"/>` +
        `<rect x="${x}" y="${y}" width="${w}" height="${Math.min(2, h / 3)}" fill="${INK}" fill-opacity="0.18"/></g>`,
    );
  }
  for (const [id, zone] of Object.entries(plan.zones)) {
    const [cx, cy] = center(zone.poly);
    // Seules les zones fermées portent leur nom (avec un cadenas) : on sait ce qui reste à ouvrir.
    if (closed.includes(id))
      out.push(
        `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Fraunces Variable, Georgia, serif" font-size="4.4" font-weight="700" fill="${INK}" fill-opacity="0.78" stroke="#fbf6e9" stroke-width="1.2" paint-order="stroke">${escapeXml(zone.nom)}</text>`,
        `<g transform="translate(${cx - 2.2} ${cy + 1.2})" fill="none" stroke="${INK}" stroke-width="0.8" stroke-linecap="round"><rect x="0" y="2.2" width="4.4" height="3.4" rx="0.6" fill="#fbf6e9"/><path d="M0.9 2.2V1.4a1.3 1.3 0 0 1 2.6 0v0.8"/></g>`,
      );
  }
  for (const m of plan.reperes) {
    const star = `${m.x},${m.y - 3} ${m.x + 0.9},${m.y - 0.9} ${m.x + 3},${m.y - 0.9} ${m.x + 1.3},${m.y + 0.5} ${m.x + 1.9},${m.y + 2.8} ${m.x},${m.y + 1.4} ${m.x - 1.9},${m.y + 2.8} ${m.x - 1.3},${m.y + 0.5} ${m.x - 3},${m.y - 0.9} ${m.x - 0.9},${m.y - 0.9}`;
    out.push(
      `<polygon points="${star}" fill="#e8c77a" stroke="${INK}" stroke-width="0.45" stroke-linejoin="round"/>`,
    );
  }
  return out.join('');
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}

/** Ce qui bouge : lieux du curseur, habitants, joueurs, cible suivie. */
export function overlaySvg(
  read: MapRead,
  model: MapModel,
  cursor: string | null,
  target: { readonly x: number; readonly y: number } | null,
): string {
  const out: string[] = [];
  for (const p of model.places)
    out.push(
      `<circle cx="${p.x}" cy="${p.y}" r="${p.id === cursor ? 1.1 : 0.8}" fill="#fbf6e9" stroke="${INK}" stroke-width="0.4"${p.closed ? ' stroke-dasharray="0.8 0.6"' : ''}/>`,
    );
  const at = model.places.find((p) => p.id === cursor);
  if (at !== undefined)
    out.push(
      `<circle class="curseur" cx="${at.x}" cy="${at.y}" r="5.6" fill="none" stroke="#24408e" stroke-width="1.3"/><circle cx="${at.x}" cy="${at.y}" r="7" fill="none" stroke="#fbf6e9" stroke-width="0.5"/>`,
    );
  for (const v of read.villagers) {
    const hue = hueOf(v.id);
    out.push(
      `<g class="portrait-carte" transform="translate(${v.x} ${v.y})"><circle r="4.2" fill="hsl(${hue} 45% 70%)" stroke="${INK}" stroke-width="0.7"/><text y="1.7" text-anchor="middle" font-size="4.8" font-weight="800" font-family="Nunito Sans Variable, system-ui, sans-serif" fill="${INK}">${escapeXml(initial(v.name))}</text>${v.something ? `<circle cx="3.6" cy="-3.6" r="1.8" fill="#a4463b" stroke="#fbf6e9" stroke-width="0.5"/>` : ''}</g>`,
    );
  }
  if (target !== null)
    out.push(
      `<g class="cible-carte" transform="translate(${target.x} ${target.y})"><path d="M0 -6.4L4.6 0 0 6.4-4.6 0z" fill="#a4463b" stroke="#fbf6e9" stroke-width="1" stroke-linejoin="round"/></g>`,
    );
  for (const p of read.players) {
    const color = p.index === 0 ? '#5ce1e6' : '#8d6cff';
    const shape =
      p.index === 0
        ? `<circle r="3.6" fill="${color}" stroke="${INK}" stroke-width="0.9"/>`
        : `<path d="M0 -4.6L4.6 0 0 4.6-4.6 0z" fill="${color}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`;
    out.push(`<g transform="translate(${p.x} ${p.y})"><g class="jeton-carte">${shape}</g></g>`);
  }
  if (read.night)
    out.push(
      `<g transform="translate(${model.width - 9} 9)"><path d="M3 0A4 4 0 1 0 6 6 3.2 3.2 0 0 1 3 0z" fill="#2f3f5c" stroke="#fbf6e9" stroke-width="0.4"/></g>`,
    );
  return out.join('');
}

// ---------- Onglet ----------

export interface MapTabOptions {
  readonly read: (world: ReadonlyWorld, local: PlayerIndex) => MapRead | null;
  readonly follow: FollowStore;
  /** Position de la cible de la suite suivie, dans le lieu courant. */
  readonly targetOf: (
    world: ReadonlyWorld,
    local: PlayerIndex,
    followed: string | null,
  ) => { x: number; y: number } | null;
  readonly shared: SharedTabState;
}

export function createMapTab(deps: TabDeps, options: MapTabOptions): Tab {
  let cursor: string | null = null;
  /** Les positions ne bougent à l'écran que toutes les `mapRefreshMs`. */
  let refresh = 0;
  let consumedFocus: string | null = null;

  function placeFor(read: MapRead, model: MapModel, local: PlayerIndex): string | null {
    const focus = options.shared.mapFocus;
    if (focus !== null && focus !== consumedFocus) {
      consumedFocus = focus;
      const v = read.villagers.find((x) => x.id === focus);
      if (v !== undefined) cursor = placeNear(model, v.x, v.y);
    }
    if (cursor === null) {
      const me = read.players.find((p) => p.index === local) ?? read.players[0];
      cursor = me === undefined ? (model.places[0]?.id ?? null) : placeNear(model, me.x, me.y);
    }
    return cursor;
  }

  return {
    render(world, local) {
      const read = options.read(world, local);
      if (read === null)
        return {
          left: [
            el('div', { class: 'vide' }, [
              icon('carte', 'ic vide__ic'),
              el('h2', { text: T.none }),
            ]),
          ],
          right: null,
          full: true,
        };
      const model = mapModel(read);
      const current = placeFor(read, model, local);
      const target = options.targetOf(world, local, options.follow.get());
      const svg = `<svg class="carte-svg" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="${escapeXml(fill(T.label, { lieu: read.plan.nom }))}" preserveAspectRatio="xMidYMid meet">${baseSvg(read.plan, model.closed)}${overlaySvg(read, model, current, target)}</svg>`;
      const frame = el('div', { class: 'carte' });
      frame.insertAdjacentHTML('beforeend', svg);
      const at = model.places.find((p) => p.id === current);
      const caption = el('div', { class: 'carte__lieu', 'aria-live': 'polite' });
      if (at !== undefined) {
        caption.append(el('b', { text: at.name.charAt(0).toUpperCase() + at.name.slice(1) }));
        if (at.closed)
          caption.append(el('span', { class: 'carte__ferme' }, [icon('cadenas'), T.closed]));
        else if (at.occupants.length === 0)
          caption.append(el('span', { class: 'carte__vide', text: T.nobody }));
        for (const o of at.occupants)
          caption.append(
            el('span', { class: 'carte__occupant' }, [
              el('i', {
                class: 'pastille-visage',
                text: initial(o.name),
                style: `background:hsl(${hueOf(o.id)} 45% 70%)`,
              }),
              o.name,
            ]),
          );
      }
      const legend = el('div', { class: 'carte__legende' }, [
        el('span', {}, [
          el('i', { class: 'token' }),
          el('i', { class: 'token token--other' }),
          T.legendPlayer,
        ]),
        el('span', {}, [el('i', { class: 'pastille-visage', text: 'A' }), T.legendVillager]),
        el('span', {}, [icon('losange', 'ic ic--cible'), T.legendTarget]),
      ]);
      // Liste des lieux pour la lecture au clavier et par lecteur d'écran.
      const list = el('ul', { class: 'sr-only' });
      for (const p of model.places)
        list.append(
          el('li', {
            text: `${p.name}${p.occupants.length > 0 ? ` : ${p.occupants.map((o) => o.name).join(', ')}` : ''}`,
          }),
        );
      return { left: [frame, caption, legend, list], right: null, full: true };
    },
    signature(world, local) {
      const read = options.read(world, local);
      if (read === null) return 'none';
      const bucket = Math.floor(performance.now() / CARNET_TUNING.mapRefreshMs);
      if (bucket !== refresh) refresh = bucket;
      return JSON.stringify([
        refresh,
        read.night,
        read.closed,
        cursor,
        options.follow.get(),
        options.shared.mapFocus,
      ]);
    },
    key(code, _shift, world, local) {
      const dir = DIRECTION_KEYS[code];
      if (dir === undefined) return false;
      const read = options.read(world, local);
      if (read === null) return true;
      const model = mapModel(read);
      cursor = nearestPlace(model.places, placeFor(read, model, local), dir);
      deps.invalidate();
      return true;
    },
    hints() {
      return [{ codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], label: T.cursorKeys }];
    },
    closed() {
      cursor = null;
      options.shared.mapFocus = null;
      consumedFocus = null;
    },
  };
}
