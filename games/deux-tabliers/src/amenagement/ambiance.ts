/**
 * Ambiance calculée objet par objet (cahier AM-01 à AM-03, démo 6.3) et cohérence de style sur la
 * roue (AM-02). Fonction pure, lue par la clientèle (attrait, satisfaction) et par l'interface
 * (tablette, bilan). La musique et la propreté viennent de la clientèle et du service: elles
 * entrent en paramètres.
 */
import type { Content } from '../donnees/charger';
import type { PlacedFurniture, World } from '../etat/monde';
import { STYLE_IDS, type PieceInfo, type StyleId } from './donnees';
import { roomOpen } from './extensions';

/** Relation d'un style au style dominant sur la roue. */
export type StyleRelation = 'dominant' | 'voisin' | 'oppose' | 'cote' | 'neutre';

export interface PieceAmbiance {
  readonly furniture: string;
  readonly type: string;
  readonly room: string;
  readonly style: StyleId | 'neutre';
  /** Charme compté (usure, brocante appliquées). */
  readonly charm: number;
  readonly relation: StyleRelation;
}

export interface Ambiance {
  /** 0 à 100 (95 au plus dans la démo). */
  readonly score: number;
  /** « Sympathique », « Chaleureuse »... (AM-03): jamais de chiffre dans le café. */
  readonly label: string;
  readonly decor: number;
  readonly coherence: number;
  /** Cohérence brute, 0 à 1. */
  readonly coherenceShare: number;
  readonly comfort: number;
  readonly light: number;
  readonly music: number;
  readonly cleanliness: number;
  readonly dominantStyle: StyleId | null;
  /** Points de charme par style (objets stylés seulement). */
  readonly styles: Readonly<Record<StyleId, number>>;
  readonly pieces: readonly PieceAmbiance[];
  /** Places assises comptées, dont confortables. */
  readonly seats: number;
  readonly comfortSeats: number;
  /** Ce qui tire l'ambiance vers le bas, en mots (tablette, AM-03). */
  readonly hints: readonly string[];
}

export interface AmbianceInputs {
  /** Points de musique (0 en silence, 2 pour une autre liste, 5 si elle va avec le style). */
  readonly music?: number;
  /** Points de propreté, de 0 à `cleanlinessMax` (10 par défaut: rien à débarrasser). */
  readonly cleanliness?: number;
}

/** Relation de `style` à `dominant` sur la roue (campagne, jardin, nordique, rétro, bistrot, atelier). */
export function styleRelation(style: StyleId | 'neutre', dominant: StyleId | null): StyleRelation {
  if (style === 'neutre') return 'neutre';
  if (dominant === null || style === dominant) return 'dominant';
  const n = STYLE_IDS.length;
  const a = STYLE_IDS.indexOf(style);
  const b = STYLE_IDS.indexOf(dominant);
  const d = Math.min((a - b + n) % n, (b - a + n) % n);
  return d === 1 ? 'voisin' : d === n / 2 ? 'oppose' : 'cote';
}

const WEIGHT: Readonly<Record<StyleRelation, number>> = {
  dominant: 1,
  voisin: 0.5,
  oppose: -0.5,
  cote: 0,
  neutre: 0,
};

export function pieceInfo(content: Content, type: string): PieceInfo | undefined {
  return content.arrangement.pieces.get(type);
}

function roomOf(content: Content, world: World, f: PlacedFurniture): string | null {
  for (const r of content.arrangement.rooms) {
    const [x, z, w, d] = r.space;
    if (roomOpen(world, r.extension) && f.x >= x && f.x <= x + w && f.z >= z && f.z <= z + d)
      return r.id;
  }
  // Une enseigne de façade compte pour la salle qu'elle annonce.
  const salle = content.arrangement.rooms.find((r) => r.extension === null);
  if (salle === undefined) return null;
  const [x, z, w, d] = salle.space;
  return f.x >= x && f.x <= x + w && f.z >= z && f.z <= z + d + 1 ? salle.id : null;
}

/** Charme compté d'une pièce posée: usure (moitié), brocante (x1,5). */
export function countedCharm(
  content: Content,
  world: World,
  f: PlacedFurniture,
  info: PieceInfo,
): number {
  let charm = info.charm;
  if (world.arrangement.worn.includes(f.id)) charm *= content.arrangement.ambiance.wornCharmFactor;
  if (info.item?.unlock.kind === 'brocante') charm *= content.arrangement.brocante.charmFactor;
  return charm;
}

export function computeAmbiance(
  content: Content,
  world: World,
  inputs: AmbianceInputs = {},
): Ambiance {
  const a = content.arrangement.ambiance;
  const raw: { f: PlacedFurniture; info: PieceInfo; room: string; charm: number }[] = [];
  for (const f of world.furniture) {
    const info = pieceInfo(content, f.type);
    if (info === undefined) continue;
    const room = roomOf(content, world, f);
    if (room === null) continue;
    raw.push({ f, info, room, charm: countedCharm(content, world, f, info) });
  }
  const styles = Object.fromEntries(STYLE_IDS.map((s) => [s, 0])) as Record<StyleId, number>;
  let charmTotal = 0;
  const add = (style: StyleId | 'neutre', charm: number): void => {
    charmTotal += charm;
    if (style !== 'neutre') styles[style] += charm;
  };
  for (const r of raw) add(r.info.style, r.charm);
  // Revêtements: charme par mur ou par mètre carré de la pièce.
  const coverings: { style: StyleId | 'neutre'; charm: number }[] = [];
  for (const room of content.arrangement.rooms) {
    if (!roomOpen(world, room.extension)) continue;
    const wall = world.arrangement.walls[room.id];
    const floor = world.arrangement.floors[room.id];
    for (const id of [wall, floor]) {
      const item = id === undefined ? undefined : content.arrangement.items.get(id);
      if (item === undefined) continue;
      const charm =
        item.charmPerM2 === true
          ? item.charm * room.surfaceM2
          : item.priceUnit === 'wall'
            ? item.charm * room.walls
            : item.charm;
      coverings.push({ style: item.style, charm });
      add(item.style, charm);
    }
  }
  let dominant: StyleId | null = null;
  for (const s of STYLE_IDS)
    if (styles[s] > 0 && (dominant === null || styles[s] > styles[dominant])) dominant = s;
  let styledTotal = 0;
  let weighted = 0;
  for (const s of STYLE_IDS) {
    styledTotal += styles[s];
    weighted += WEIGHT[styleRelation(s, dominant)] * styles[s];
  }
  const coherenceShare = styledTotal > 0 ? Math.max(0, Math.min(1, weighted / styledTotal)) : 0;

  // Surface ouverte au public: la terrasse ne dilue pas le décor (démo 6.3).
  let surface = 0;
  for (const room of content.arrangement.rooms) {
    if (!roomOpen(world, room.extension) || room.outdoor) continue;
    surface += room.surfaceM2;
  }
  surface = Math.max(1, surface);
  const decor = Math.min(a.decorMax, (a.decorMax * charmTotal) / (a.charmPerM2ForMax * surface));
  const coherence = a.coherenceMax * coherenceShare;

  let seats = 0;
  let comfortSeats = 0;
  let lights = 0;
  for (const r of raw) {
    const type = content.furniture.get(r.f.type);
    if (type?.kind === 'seat' && r.info.seats !== undefined) {
      seats += r.info.seats.count;
      if (r.info.seats.type === 'comfort') comfortSeats += r.info.seats.count;
    }
    if (r.info.category === 'light') lights++;
  }
  const comfort = seats > 0 ? Math.min(a.comfortMax, (a.comfortFactor * comfortSeats) / seats) : 0;
  const light = Math.min(a.lightMax, (a.lightMax * lights) / (surface / a.lightPerM2));
  const music = Math.max(0, inputs.music ?? 0);
  const cleanliness = Math.max(
    0,
    Math.min(a.cleanlinessMax, inputs.cleanliness ?? a.cleanlinessMax),
  );
  const score = Math.round(
    Math.max(0, Math.min(100, decor + coherence + comfort + light + music + cleanliness)),
  );
  let label = a.words[0]?.label ?? '';
  for (const w of a.words) if (score >= w.from) label = w.label;

  const hints: string[] = [];
  if (decor < a.decorMax * 0.5) hints.push('La salle manque encore de décoration.');
  if (coherenceShare < 0.6 && styledTotal > 0) hints.push('Les styles se heurtent un peu.');
  if (light < a.lightMax * 0.5) hints.push('Un luminaire de plus réchaufferait la salle.');
  if (comfort < a.comfortMax * 0.3) hints.push('Un fauteuil donnerait envie de rester.');
  if (world.arrangement.worn.length > 0) hints.push('Le mobilier de Simone attend sa rénovation.');

  return {
    score,
    label,
    decor,
    coherence,
    coherenceShare,
    comfort,
    light,
    music,
    cleanliness,
    dominantStyle: dominant,
    styles,
    pieces: raw.map((r) => ({
      furniture: r.f.id,
      type: r.f.type,
      room: r.room,
      style: r.info.style,
      charm: r.charm,
      relation: styleRelation(r.info.style, dominant),
    })),
    seats,
    comfortSeats,
    hints,
  };
}

const STYLE_LABEL: Readonly<Record<StyleId, string>> = {
  campagne: 'campagne',
  jardin: 'jardin',
  nordique: 'nordique',
  retro: 'rétro',
  bistrot: 'bistrot',
  atelier: 'atelier',
};

/** Ce que dit l'invite en tenant un objet (ux 6.3): son effet sur la salle, en mots. */
export function styleNote(content: Content, world: World, type: string): string {
  const info = pieceInfo(content, type);
  if (info === undefined) return '';
  if (info.style === 'neutre') return 'Objet simple : va avec tout.';
  const dominant = computeAmbiance(content, world).dominantStyle;
  const name = STYLE_LABEL[info.style];
  if (dominant === null) return `Style ${name} : il donnera le ton à la salle.`;
  const room = STYLE_LABEL[dominant];
  const relation = styleRelation(info.style, dominant);
  if (relation === 'dominant') return `Style ${name} : va bien avec la salle.`;
  if (relation === 'voisin') return `Style ${name} : s'accorde avec la salle ${room}.`;
  if (relation === 'oppose') return `Style ${name} : détonne avec la salle ${room}.`;
  return `Style ${name} : côtoie la salle ${room} sans la gêner.`;
}
