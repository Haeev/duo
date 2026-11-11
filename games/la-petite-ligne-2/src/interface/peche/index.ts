/**
 * Interface du mini-jeu de pêche: un médaillon sans texte, sous le personnage, qui laisse voir
 * l'eau. Visée (repère dans l'eau et jauge de distance), touche (bouchon qui frémit puis plonge),
 * combat (arc de tension, aiguille, moulinet qui brille au souffle), puis la fête de la prise.
 * La partie se joue ici (`simulation/peche/local.ts`); l'hôte valide le résultat.
 *
 * Pêche à deux (prise unique, `simulation/peche/a-deux.ts`): les deux écrans diffèrent. À la canne,
 * le ressenti (côté et force de ses élans, ses forces) sans l'eau; à l'épuisette, l'eau vue de la
 * berge (ombre, bulles, couloirs) sans le ressenti. Il faut se parler.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Aim } from '../../simulation/briques/types';
import { SIM_DT } from '../../simulation/noyau/constantes';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import {
  pairFatigue,
  pairPhase,
  pairRole,
  pairWarning,
  type Lane,
  type PairPhase,
} from '../../simulation/peche/a-deux';
import {
  baitChoices,
  canStartFishing,
  createLocalFishing,
  defaultBait,
  type LocalFishing,
  type LocalPhase,
} from '../../simulation/peche/local';
import { FISHING } from '../../simulation/peche/reglages';
import type { ProjectToScreen } from '../hud';
import { FISHING_TEXTS, formatSize } from './textes';
import './peche.css';

export interface FishingOverlayOptions {
  readonly layer: HTMLElement;
  readonly content: Content;
  readonly world: () => ReadonlyWorld | null;
  readonly local: () => PlayerIndex | null;
  readonly aim: (player: PlayerIndex) => Aim | null;
  readonly send: (intent: Intent) => void;
  readonly keyLabel: (code: string) => string;
  readonly projectToScreen?: ProjectToScreen;
  readonly keyTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /** Signal sonore de l'interface (`peche-moulinet` pendant la tirée). */
  readonly onCue?: (cue: string) => void;
}

export interface FishingOverlay {
  /** Une image: `dt` en secondes. */
  frame(dt: number): void;
  /** La pêche prend le clavier: ni marche ni touche d'action pendant la partie. */
  capturing(): boolean;
  onEvent(event: GameEvent): void;
  dispose(): void;
}

/** Demi-ouverture de l'arc de tension (degrés). */
const ARC = 80;
const R = 92;
/** Durée de la fête: espèce nouvelle, puis espèce connue (ms). */
const FEAST_NEW_MS = 4200;
const FEAST_KNOWN_MS = 1800;
/** Pendant la tirée, le moulinet fait son bruit à l'appui puis toutes les 0,7 s (durée du son). */
const REEL_CUE_PERIOD_S = 0.7;
/** Pêche à deux: durée des messages d'un plongeon raté et d'un poisson parti (s). */
const NOTICE_MISSED_S = 2.2;
const NOTICE_ESCAPED_S = 4;

function polar(deg: number, radius: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(Math.sin(a) * radius).toFixed(1)} ${(-Math.cos(a) * radius).toFixed(1)}`;
}

function arcPath(from: number, to: number, radius: number): string {
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${polar(from, radius)} A ${String(radius)} ${String(radius)} 0 ${String(large)} 1 ${polar(to, radius)}`;
}

const MARKUP = `
<div class="lpl-peche__repere" aria-hidden="true"><span></span></div>
<svg class="lpl-peche__jeu" viewBox="-130 -125 260 165" aria-hidden="true">
  <g class="lpl-peche__visee">
    <line x1="0" y1="18" x2="0" y2="-98" class="lpl-peche__rail" />
    <g class="lpl-peche__curseur"><circle r="9" class="lpl-peche__bouchon-haut" /><path d="M -9 0 A 9 9 0 0 0 9 0 Z" class="lpl-peche__bouchon-bas" /></g>
  </g>
  <g class="lpl-peche__touche">
    <ellipse class="lpl-peche__rond lpl-peche__rond--1" rx="34" ry="11" cy="-40" />
    <ellipse class="lpl-peche__rond lpl-peche__rond--2" rx="52" ry="17" cy="-40" />
    <g class="lpl-peche__flotteur"><rect x="-1.5" y="-78" width="3" height="18" class="lpl-peche__antenne" /><circle cy="-52" r="12" class="lpl-peche__bouchon-haut" /><path d="M -12 -52 A 12 12 0 0 0 12 -52 Z" class="lpl-peche__bouchon-bas" /></g>
    <line x1="-70" y1="-40" x2="70" y2="-40" class="lpl-peche__eau" />
  </g>
  <g class="lpl-peche__combat">
    <path class="lpl-peche__arc" d="${arcPath(-ARC, ARC, R)}" />
    <path class="lpl-peche__zone" />
    <path class="lpl-peche__tension" />
    <line class="lpl-peche__aiguille" x1="0" y1="0" x2="0" y2="-${String(R + 8)}" />
    <circle class="lpl-peche__pivot" r="7" />
    <g class="lpl-peche__poisson"><path d="M -10 0 Q 0 -8 10 0 Q 0 8 -10 0 Z M 10 0 L 17 -6 L 17 6 Z" /></g>
    <line class="lpl-peche__piste" x1="-90" y1="30" x2="90" y2="30" />
    <g class="lpl-peche__moulinet" transform="translate(0 30)"><circle r="13" /><path d="M 0 -13 V 13 M -13 0 H 13" /></g>
  </g>
  <g class="lpl-peche__touches">
    <g class="lpl-peche__touche-g" transform="translate(-112 18)"><rect x="-13" y="-13" width="26" height="26" rx="5" /><text y="5"></text></g>
    <g class="lpl-peche__touche-d" transform="translate(112 18)"><rect x="-13" y="-13" width="26" height="26" rx="5" /><text y="5"></text></g>
  </g>
</svg>
<p class="lpl-peche__appat"></p>
<svg class="lpl-peche__ressenti" viewBox="-130 -125 260 165" aria-hidden="true">
  <path class="lpl-peche__ressenti-arc" d="${arcPath(-ARC, ARC, R)}" />
  <g class="lpl-peche__tire"><path d="M 0 -${String(R + 18)} L -16 -${String(R - 14)} L 16 -${String(R - 14)} Z" /></g>
  <text class="lpl-peche__forces-titre" y="12"></text>
  <rect class="lpl-peche__forces-fond" x="-60" y="20" width="120" height="10" rx="5" />
  <rect class="lpl-peche__forces" x="-60" y="20" width="120" height="10" rx="5" />
  <g class="lpl-peche__touches"><g class="lpl-peche__touche-espace" transform="translate(0 -40)"><rect x="-34" y="-13" width="68" height="26" rx="5" /><text y="5"></text></g></g>
</svg>
<svg class="lpl-peche__eaux" viewBox="-120 -165 240 205" aria-hidden="true">
  <rect class="lpl-peche__eaux-fond" x="-110" y="-160" width="220" height="150" rx="14" />
  <path class="lpl-peche__couloirs" d="M -36 -150 V -20 M 36 -150 V -20" />
  <ellipse class="lpl-peche__ombre" rx="16" ry="44" />
  <g class="lpl-peche__bulles"><circle r="5" cx="-8" cy="0" /><circle r="3.5" cx="7" cy="-9" /><circle r="4" cx="4" cy="10" /></g>
  <rect class="lpl-peche__berge" x="-112" y="-12" width="224" height="16" rx="4" />
  <g class="lpl-peche__epuisette"><path d="M -28 -12 A 28 22 0 0 1 28 -12" /><line x1="0" y1="-12" x2="0" y2="26" /></g>
  <g class="lpl-peche__touches">
    <g class="lpl-peche__touche-g" transform="translate(-92 22)"><rect x="-13" y="-13" width="26" height="26" rx="5" /><text y="5"></text></g>
    <g class="lpl-peche__touche-espace" transform="translate(0 22)"><rect x="-34" y="-13" width="68" height="26" rx="5" /><text y="5"></text></g>
    <g class="lpl-peche__touche-d" transform="translate(92 22)"><rect x="-13" y="-13" width="26" height="26" rx="5" /><text y="5"></text></g>
  </g>
</svg>
<p class="lpl-peche__consigne"></p>
<div class="lpl-peche__fete" hidden>
  <svg class="lpl-peche__portrait" viewBox="-60 -24 120 48" aria-hidden="true"><path d="M -42 0 Q -10 -22 30 0 Q -10 22 -42 0 Z M 30 0 L 50 -14 L 46 0 L 50 14 Z" /><circle cx="-28" cy="-4" r="3" class="lpl-peche__oeil" /></svg>
  <p class="lpl-peche__titre"></p>
  <p class="lpl-peche__nom"></p>
  <p class="lpl-peche__taille"></p>
  <p class="lpl-peche__etoiles" aria-hidden="true"></p>
  <p class="lpl-peche__bonus"></p>
</div>`;

export function createFishingOverlay(options: FishingOverlayOptions): FishingOverlay {
  const { content, send, keyLabel } = options;
  const root = document.createElement('div');
  root.className = 'lpl-peche';
  root.dataset.phase = 'closed';
  root.innerHTML = MARKUP;
  options.layer.append(root);
  function q<T extends Element>(selector: string, type: abstract new () => T): T {
    const found = root.querySelector(selector);
    if (!(found instanceof type)) throw new Error(`pêche: ${selector} absent`);
    return found;
  }
  const marker = q('.lpl-peche__repere', HTMLElement);
  const cursor = q('.lpl-peche__curseur', SVGGElement);
  const float = q('.lpl-peche__flotteur', SVGGElement);
  const zone = q('.lpl-peche__zone', SVGPathElement);
  const strain = q('.lpl-peche__tension', SVGPathElement);
  const needle = q('.lpl-peche__aiguille', SVGLineElement);
  const fish = q('.lpl-peche__poisson', SVGGElement);
  const reel = q('.lpl-peche__moulinet', SVGGElement);
  const feast = q('.lpl-peche__fete', HTMLElement);
  const baitLine = q('.lpl-peche__appat', HTMLElement);
  const hint = q('.lpl-peche__consigne', HTMLElement);
  const pull = q('.lpl-peche__tire', SVGGElement);
  const strength = q('.lpl-peche__forces', SVGRectElement);
  const shadow = q('.lpl-peche__ombre', SVGEllipseElement);
  const bubbles = q('.lpl-peche__bulles', SVGGElement);
  const net = q('.lpl-peche__epuisette', SVGGElement);
  const spaceKeys = root.querySelectorAll('.lpl-peche__touche-espace');
  const leftKeys = root.querySelectorAll('.lpl-peche__touche-g');
  const rightKeys = root.querySelectorAll('.lpl-peche__touche-d');
  for (const [list, code] of [
    [leftKeys, 'KeyA'],
    [rightKeys, 'KeyD'],
    [spaceKeys, 'Space'],
  ] as const)
    for (const key of list) {
      const text = key.querySelector('text');
      if (text !== null) text.textContent = keyLabel(code);
    }
  q('.lpl-peche__forces-titre', SVGTextElement).textContent = FISHING_TEXTS.pairStrength;

  let game: LocalFishing | null = null;
  let feastLeft = 0;
  let reelCueIn = 0;
  let zoneDrawn = -1;
  const keys = { left: false, right: false, space: false };
  /** À l'épuisette: couloir visé et position affichée (glisse d'un couloir à l'autre). */
  let netLane: Lane = 0;
  let netPos = 0;
  let netting = false;
  /** Message d'un plongeon raté ou d'un poisson parti, sur les deux écrans (s). */
  let noticeLeft = 0;
  const phaseOut: PairPhase = { kind: 'pull', side: 0, into: 0, length: 1 };

  function steer(): -1 | 0 | 1 {
    return keys.left === keys.right ? 0 : keys.left ? -1 : 1;
  }

  /** Mon rôle dans une pêche à deux en cours, ou `null`. */
  function pairOf(world: ReadonlyWorld, me: PlayerIndex): ReturnType<typeof pairRole> {
    const lines = world.places[world.common.place]?.fishing?.lines;
    return lines === undefined ? null : pairRole(lines, me);
  }

  function say(text: string, seconds: number): void {
    hint.textContent = text;
    noticeLeft = seconds;
  }

  const onKey = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent)) return;
    const down = raw.type === 'keydown';
    if (raw.code === 'KeyA') keys.left = down;
    else if (raw.code === 'KeyD') keys.right = down;
    else if (raw.code === 'Space') keys.space = down;
    const keyOfGame = ['KeyA', 'KeyD', 'Space', 'KeyS'].includes(raw.code);
    if (!down || raw.repeat) {
      if ((game !== null || netting) && keyOfGame) raw.preventDefault();
      return;
    }
    const world = options.world();
    const me = options.local();
    if (world === null || me === null) return;
    if (netting) {
      // À l'épuisette: Q et D d'un couloir à l'autre, Espace pour plonger.
      if (raw.code === 'KeyA') netLane = netLane === 1 ? 0 : -1;
      else if (raw.code === 'KeyD') netLane = netLane === -1 ? 0 : 1;
      else if (raw.code === 'Space') send({ type: 'fish_net', lane: netLane });
      else return;
      raw.preventDefault();
      return;
    }
    if (game === null) {
      // Canne en main face à l'eau, sans autre cible: Espace sort la ligne.
      if (raw.code === 'Space' && options.aim(me) === null && canStartFishing(content, world, me)) {
        game = createLocalFishing(content, me);
        game.setBait(defaultBait(content, world, me));
        feastLeft = 0;
        raw.preventDefault();
      }
      return;
    }
    if (raw.code === 'KeyS' && game.phase().kind === 'aim') {
      // Appât suivant parmi ceux qu'on a sur soi (et sans appât).
      const choices = baitChoices(content, world, me);
      const at = choices.indexOf(game.bait());
      game.setBait(choices[(at + 1) % choices.length] ?? null);
    } else if (raw.code === 'Space') game.press();
    else if (raw.code === 'Backspace') game.cancel();
    else if (raw.code !== 'KeyA' && raw.code !== 'KeyD') return;
    raw.preventDefault();
  };
  options.keyTarget.addEventListener('keydown', onKey);
  options.keyTarget.addEventListener('keyup', onKey);

  function drawKeys(): void {
    for (const key of leftKeys) key.classList.toggle('lpl-peche--appui', keys.left);
    for (const key of rightKeys) key.classList.toggle('lpl-peche--appui', keys.right);
    for (const key of spaceKeys) key.classList.toggle('lpl-peche--appui', keys.space);
  }

  function drawBait(world: ReadonlyWorld, me: PlayerIndex, current: string | null): void {
    // Seulement si l'on a de quoi amorcer: sinon la visée reste sans texte.
    const shown = baitChoices(content, world, me).length > 1;
    baitLine.hidden = !shown;
    if (!shown) return;
    const name = current === null ? null : (content.items[current]?.name ?? current);
    const key = keyLabel('KeyS');
    baitLine.textContent =
      name === null
        ? FISHING_TEXTS.noBait.replace('{touche}', key)
        : FISHING_TEXTS.bait.replace('{appat}', name).replace('{touche}', key);
  }

  /** À la canne: le ressenti de ses élans (côté, force), sans rien voir de l'eau. */
  function drawRod(world: ReadonlyWorld, me: PlayerIndex): void {
    const line = world.places[world.common.place]?.fishing?.lines[me] ?? null;
    const pair = line?.pair;
    if (line === null || pair === undefined) return;
    const phase = pairPhase(line, pair, world.tick * SIM_DT, phaseOut);
    const pulling = phase.kind === 'pull' || phase.kind === 'dive';
    const fatigue = pairFatigue(pair);
    root.classList.toggle('lpl-peche--tire', pulling);
    const shake = pulling ? Math.sin(world.tick * 2.1) * 4 * (1 - 0.5 * fatigue) : 0;
    pull.setAttribute('transform', `rotate(${(phase.side * 55 + shake).toFixed(1)})`);
    pull.style.opacity = pulling ? (1 - 0.45 * fatigue).toFixed(2) : '0';
    strength.setAttribute('width', (120 * (1 - fatigue)).toFixed(1));
    if (noticeLeft <= 0)
      hint.textContent = FISHING_TEXTS.pairRod.replace('{espace}', keyLabel('Space'));
  }

  /** À l'épuisette: l'eau vue de la berge (ombre, bulles), sans rien sentir. */
  function drawNet(world: ReadonlyWorld, angler: PlayerIndex, dt: number): void {
    const line = world.places[world.common.place]?.fishing?.lines[angler] ?? null;
    const pair = line?.pair;
    if (line === null || pair === undefined) return;
    const phase = pairPhase(line, pair, world.tick * SIM_DT, phaseOut);
    const step = dt / Math.max(0.05, FISHING.pair.laneSeconds);
    netPos = netPos < netLane ? Math.min(netLane, netPos + step) : Math.max(netLane, netPos - step);
    net.setAttribute('transform', `translate(${(netPos * 72).toFixed(1)} 0)`);
    // Au fond, une ombre floue; à la remontée, l'ombre sombre au bord, dans son couloir.
    const rising = phase.kind === 'rise';
    const k = rising ? Math.min(1, phase.into / 0.4) : 0;
    const side = phase.kind === 'rest' ? 0 : phase.side;
    const y = rising ? -120 + 75 * k : -120;
    shadow.setAttribute('transform', `translate(${(side * 72).toFixed(1)} ${y.toFixed(1)})`);
    shadow.style.opacity = rising ? (0.45 + 0.45 * k).toFixed(2) : '0.16';
    bubbles.style.opacity = pairWarning(phase) ? '1' : '0';
    bubbles.setAttribute('transform', `translate(${(side * 72).toFixed(1)} -70)`);
    if (noticeLeft <= 0)
      hint.textContent = FISHING_TEXTS.pairNet
        .replace('{gauche}', keyLabel('KeyA'))
        .replace('{droite}', keyLabel('KeyD'))
        .replace('{espace}', keyLabel('Space'));
  }

  function draw(phase: LocalPhase): void {
    root.dataset.phase = feastLeft > 0 ? 'fete' : phase.kind;
    drawKeys();
    if (phase.kind === 'aim' || phase.kind === 'cast' || phase.kind === 'bite') {
      const at = options.projectToScreen?.(phase.x, phase.y, 0) ?? null;
      marker.hidden = at === null;
      if (at !== null)
        marker.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
    } else marker.hidden = true;
    if (phase.kind === 'aim')
      cursor.setAttribute('transform', `translate(0 ${(10 - phase.reach * 100).toFixed(1)})`);
    if (phase.kind === 'bite') {
      float.setAttribute('transform', `translate(0 ${(phase.dip * 22).toFixed(1)})`);
      root.classList.toggle('lpl-peche--plonge', phase.plunge);
    }
    if (phase.kind === 'fight') {
      const f = phase.fight;
      if (f.zoneHalf !== zoneDrawn) {
        zone.setAttribute('d', arcPath(-ARC * f.zoneHalf, ARC * f.zoneHalf, R));
        zoneDrawn = f.zoneHalf;
      }
      const deg = f.needle * ARC;
      needle.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
      const share = Math.min(1, f.strain / 1.5);
      strain.setAttribute('d', share <= 0.01 ? '' : arcPath(-ARC, -ARC + 2 * ARC * share, R + 14));
      fish.setAttribute(
        'transform',
        `translate(${(90 - 180 * Math.min(1, f.progress)).toFixed(1)} 30)`,
      );
      root.classList.toggle('lpl-peche--souffle', !f.pulling);
      root.classList.toggle('lpl-peche--hors', Math.abs(f.needle) > f.zoneHalf);
      reel.classList.toggle('lpl-peche--appui', keys.space);
    }
  }

  /** La fête de la prise; `fromNet`: vue de l'épuisette (le nom est celui de la canne). */
  function celebrate(event: Extract<GameEvent, { type: 'fish_caught' }>, fromNet = false): void {
    const def = content.catches[event.catch];
    const name = content.items[def?.item ?? '']?.name ?? event.catch;
    const world = options.world();
    const other = fromNet
      ? (world?.players[event.player].name ?? '')
      : (world?.players[event.player === 0 ? 1 : 0].name ?? '');
    root.classList.toggle('lpl-peche--nouveau', event.isNew);
    root.classList.toggle('lpl-peche--gros', event.big);
    q('.lpl-peche__titre', HTMLElement).textContent = event.isNew ? FISHING_TEXTS.newCatch : '';
    q('.lpl-peche__nom', HTMLElement).textContent =
      event.count > 1 ? `${name} x${String(event.count)}` : name;
    q('.lpl-peche__taille', HTMLElement).textContent =
      formatSize(event.sizeMm) + (event.record ? ` · ${FISHING_TEXTS.record}` : '');
    q('.lpl-peche__etoiles', HTMLElement).textContent =
      '★'.repeat(event.quality) + '☆'.repeat(3 - event.quality);
    q('.lpl-peche__bonus', HTMLElement).textContent = event.together
      ? (fromNet ? FISHING_TEXTS.rodBy : FISHING_TEXTS.together).replace('{nom}', other)
      : '';
    const range = def?.fish?.sizeCm;
    const scale =
      range === undefined
        ? 1
        : 0.7 +
          0.5 * Math.min(1, (event.sizeMm / 10 - range.min) / Math.max(1, range.max - range.min));
    q('.lpl-peche__portrait', SVGSVGElement).style.setProperty('--taille', scale.toFixed(2));
    feast.hidden = false;
    root.dataset.phase = 'fete';
    feastLeft = event.isNew ? FEAST_NEW_MS : FEAST_KNOWN_MS;
  }

  return {
    frame(dt) {
      if (feastLeft > 0) {
        feastLeft -= dt * 1000;
        if (feastLeft <= 0) {
          feast.hidden = true;
          root.dataset.phase = 'closed';
        }
      }
      if (noticeLeft > 0) noticeLeft -= dt;
      const world = options.world();
      const me = options.local();
      // À l'épuisette d'une pêche à deux: l'eau, sans la canne.
      const role = world === null || me === null ? null : pairOf(world, me);
      if (role?.role === 'net' && world !== null && feastLeft <= 0) {
        if (!netting) {
          netting = true;
          netLane = 0;
          netPos = 0;
        }
        root.dataset.phase = 'pair-epuisette';
        drawKeys();
        drawNet(world, role.angler, dt);
        return;
      }
      netting = false;
      if (game === null || world === null || me === null) {
        if (feastLeft <= 0) root.dataset.phase = noticeLeft > 0 ? 'avis' : 'closed';
        marker.hidden = true;
        return;
      }
      game.hold({ steer: steer(), reel: keys.space });
      for (const intent of game.update(dt, world)) send(intent);
      const phase = game.phase();
      if (phase.kind === 'aim') drawBait(world, me, game.bait());
      if ((phase.kind === 'fight' || phase.kind === 'pair') && keys.space) {
        reelCueIn -= dt;
        if (reelCueIn <= 0) {
          options.onCue?.('peche-moulinet');
          reelCueIn = REEL_CUE_PERIOD_S;
        }
      } else reelCueIn = 0;
      if (phase.kind === 'closed') game = null;
      draw(phase);
      if (phase.kind === 'pair') {
        root.dataset.phase = feastLeft > 0 ? 'fete' : 'pair-canne';
        drawRod(world, me);
      }
    },
    capturing() {
      if (netting) return true;
      const phase = game?.phase().kind;
      return phase !== undefined && phase !== 'closed' && phase !== 'end';
    },
    onEvent(event) {
      const me = options.local();
      const wasNetting = netting;
      const mine = game !== null && game.phase().kind === 'pair';
      if (event.type === 'fish_caught' && event.player === me) {
        game = null;
        celebrate(event);
      } else if (event.type === 'fish_caught' && wasNetting) {
        netting = false;
        celebrate(event, true);
      } else if (event.type === 'fish_lost' && (event.player === me || wasNetting)) {
        if (event.player === me) game = null;
        netting = false;
        if (event.reason === 'escaped' && (mine || wasNetting))
          say(FISHING_TEXTS.pairEscaped, NOTICE_ESCAPED_S);
        root.dataset.phase = feastLeft > 0 ? 'fete' : noticeLeft > 0 ? 'avis' : 'closed';
      } else if (event.type === 'fish_net_missed' && (mine || wasNetting)) {
        say(FISHING_TEXTS.netMissed[event.reason], NOTICE_MISSED_S);
      }
    },
    dispose() {
      options.keyTarget.removeEventListener('keydown', onKey);
      options.keyTarget.removeEventListener('keyup', onKey);
      root.remove();
    },
  };
}
