/**
 * Interface du mini-jeu de pêche: un médaillon sans texte, sous le personnage, qui laisse voir
 * l'eau. Visée (repère dans l'eau et jauge de distance), touche (bouchon qui frémit puis plonge),
 * combat (arc de tension, aiguille, moulinet qui brille au souffle), puis la fête de la prise.
 * La partie se joue ici (`simulation/peche/local.ts`); l'hôte valide le résultat.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Aim } from '../../simulation/briques/types';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import {
  canStartFishing,
  createLocalFishing,
  type LocalFishing,
  type LocalPhase,
} from '../../simulation/peche/local';
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
  const keyLeft = q('.lpl-peche__touche-g', SVGGElement);
  const keyRight = q('.lpl-peche__touche-d', SVGGElement);
  const feast = q('.lpl-peche__fete', HTMLElement);
  q('.lpl-peche__touche-g text', SVGTextElement).textContent = keyLabel('KeyA');
  q('.lpl-peche__touche-d text', SVGTextElement).textContent = keyLabel('KeyD');

  let game: LocalFishing | null = null;
  let feastLeft = 0;
  let reelCueIn = 0;
  let zoneDrawn = -1;
  const keys = { left: false, right: false, space: false };

  function steer(): -1 | 0 | 1 {
    return keys.left === keys.right ? 0 : keys.left ? -1 : 1;
  }

  const onKey = (raw: Event): void => {
    if (!(raw instanceof KeyboardEvent)) return;
    const down = raw.type === 'keydown';
    if (raw.code === 'KeyA') keys.left = down;
    else if (raw.code === 'KeyD') keys.right = down;
    else if (raw.code === 'Space') keys.space = down;
    if (!down || raw.repeat) {
      if (game !== null && ['KeyA', 'KeyD', 'Space'].includes(raw.code)) raw.preventDefault();
      return;
    }
    const world = options.world();
    const me = options.local();
    if (world === null || me === null) return;
    if (game === null) {
      // Canne en main face à l'eau, sans autre cible: Espace sort la ligne.
      if (raw.code === 'Space' && options.aim(me) === null && canStartFishing(content, world, me)) {
        game = createLocalFishing(content, me);
        feastLeft = 0;
        raw.preventDefault();
      }
      return;
    }
    if (raw.code === 'Space') game.press();
    else if (raw.code === 'Backspace') game.cancel();
    else if (raw.code !== 'KeyA' && raw.code !== 'KeyD') return;
    raw.preventDefault();
  };
  options.keyTarget.addEventListener('keydown', onKey);
  options.keyTarget.addEventListener('keyup', onKey);

  function draw(phase: LocalPhase): void {
    root.dataset.phase = feastLeft > 0 ? 'fete' : phase.kind;
    keyLeft.classList.toggle('lpl-peche--appui', keys.left);
    keyRight.classList.toggle('lpl-peche--appui', keys.right);
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

  function celebrate(event: Extract<GameEvent, { type: 'fish_caught' }>): void {
    const def = content.catches[event.catch];
    const name = content.items[def?.item ?? '']?.name ?? event.catch;
    const world = options.world();
    const other = world?.players[event.player === 0 ? 1 : 0].name ?? '';
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
      ? FISHING_TEXTS.together.replace('{nom}', other)
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
      const world = options.world();
      if (game === null || world === null) {
        if (feastLeft <= 0) root.dataset.phase = 'closed';
        marker.hidden = true;
        return;
      }
      game.hold({ steer: steer(), reel: keys.space });
      for (const intent of game.update(dt, world)) send(intent);
      const phase = game.phase();
      if (phase.kind === 'fight' && keys.space) {
        reelCueIn -= dt;
        if (reelCueIn <= 0) {
          options.onCue?.('peche-moulinet');
          reelCueIn = REEL_CUE_PERIOD_S;
        }
      } else reelCueIn = 0;
      if (phase.kind === 'closed') game = null;
      draw(phase);
    },
    capturing() {
      const phase = game?.phase().kind;
      return phase !== undefined && phase !== 'closed' && phase !== 'end';
    },
    onEvent(event) {
      const me = options.local();
      if (event.type === 'fish_caught' && event.player === me) {
        game = null;
        celebrate(event);
      } else if (event.type === 'fish_lost' && event.player === me) {
        game = null;
        root.dataset.phase = feastLeft > 0 ? 'fete' : 'closed';
      }
    },
    dispose() {
      options.keyTarget.removeEventListener('keydown', onKey);
      options.keyTarget.removeEventListener('keyup', onKey);
      root.remove();
    },
  };
}
