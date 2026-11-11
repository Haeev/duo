/**
 * Jauge d'endurance du HUD (réponse du client du 2026-11-11): un trait discret sous l'horloge,
 * montré seulement quand la jauge n'est pas pleine ou qu'un renfort tient. Sans chiffres: la
 * longueur remplie dit ce qui reste, la jauge s'allonge pendant un renfort de capacité, des
 * chevrons dorés disent la recharge renforcée, la teinte éteinte et un cran disent l'essoufflement
 * et le seuil où l'on recourt. Chaque joueur ne voit que la sienne. Styles: `endurance.css`.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';
import { recoveryFactor, staminaCapacity } from '../simulation/besoins/endurance';
import { el, setAttr, show, toggle } from './dom';
import './endurance.css';

/** Réglages d'affichage de la jauge. */
export const STAMINA_UI = {
  /** Jauge de nouveau pleine: elle reste encore ce temps avant de s'effacer (ms). */
  lingerMs: 1200,
  /** En dessous de cette part, la jauge dit « presque vide ». */
  lowShare: 0.25,
} as const;

/** Textes lus par les lecteurs d'écran (tutoiement). */
export const STAMINA_TEXTS = {
  label: 'Ton souffle',
  full: 'plein',
  high: 'bon',
  half: 'à moitié',
  low: 'presque vide',
  winded: 'tu reprends ton souffle, tu marches',
  capacity: 'souffle allongé par un bon repas',
  recovery: 'souffle qui revient plus vite',
} as const;

/** Ce que montre la jauge, calculé sans DOM (testé dans Node). */
export interface StaminaView {
  /** Part remplie de la jauge affichée (0 à 1). */
  readonly fill: number;
  /** Longueur de la jauge, 1 pour la jauge de base (plus pendant un renfort de capacité). */
  readonly length: number;
  /** Fin de la jauge de base sur la jauge affichée (1 sans renfort de capacité). */
  readonly baseEnd: number;
  /** Seuil de reprise de la course, sur la jauge affichée. */
  readonly recoverMark: number;
  readonly winded: boolean;
  readonly capacityBoost: boolean;
  readonly recoveryBoost: boolean;
  /** Pleine et sans renfort: rien à montrer. */
  readonly idle: boolean;
}

export function staminaView(
  content: Content,
  world: ReadonlyWorld,
  local: PlayerIndex,
): StaminaView {
  const player = world.players[local];
  const mods = player.staminaMods;
  const length = staminaCapacity(mods, world.tick);
  const capacityBoost = length > 1;
  const recoveryBoost = recoveryFactor(mods, world.tick) > 1;
  const fill = Math.max(0, Math.min(1, player.stamina / length));
  return {
    fill,
    length,
    baseEnd: 1 / length,
    recoverMark: content.needs.stamina.recoverAt / length,
    winded: mods.winded,
    capacityBoost,
    recoveryBoost,
    idle: fill >= 1 - 1e-6 && !capacityBoost && !recoveryBoost && !mods.winded,
  };
}

function ariaOf(view: StaminaView): string {
  const t = STAMINA_TEXTS;
  const level = view.winded
    ? t.winded
    : view.fill >= 1 - 1e-6
      ? t.full
      : view.fill > 0.6
        ? t.high
        : view.fill > STAMINA_UI.lowShare
          ? t.half
          : t.low;
  const boosts = [view.capacityBoost ? t.capacity : null, view.recoveryBoost ? t.recovery : null];
  return [`${t.label} : ${level}`, ...boosts.filter((b) => b !== null)].join(', ');
}

/** Picto du souffle (trois traits de vent), en `currentColor`. */
function breathIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'stamina__ic');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<path d="M3 9h10.5a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 17h6"/>';
  return svg;
}

/** Chevrons de la recharge renforcée. */
function chevrons(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'stamina__boost');
  svg.setAttribute('viewBox', '0 0 16 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M2 2l4 4-4 4"/><path d="M8 2l4 4-4 4"/>';
  return svg;
}

export interface StaminaGauge {
  frame(now: number, world: ReadonlyWorld, local: PlayerIndex, menu: boolean): void;
  dispose(): void;
}

export function createStaminaGauge(root: HTMLElement, content: Content): StaminaGauge {
  const fill = el('i', { class: 'stamina__fill' });
  const base = el('i', { class: 'stamina__base' });
  const mark = el('i', { class: 'stamina__mark' });
  const track = el('div', { class: 'stamina__track' }, [fill, base, mark]);
  const boost = chevrons();
  const node = el('div', { class: 'stamina', role: 'img' }, [breathIcon(), track]);
  node.append(boost);
  node.hidden = true;
  root.append(node);
  let lastBusy = Number.NEGATIVE_INFINITY;
  let drawn = '';

  return {
    frame(now, world, local, menu) {
      const view = staminaView(content, world, local);
      if (!view.idle) lastBusy = now;
      const visible = !menu && now - lastBusy <= STAMINA_UI.lingerMs;
      show(node, visible);
      if (!visible) return;
      // Le trait rempli ne bouge que par `transform` (PC de référence).
      const scale = `scaleX(${view.fill.toFixed(3)})`;
      if (fill.style.transform !== scale) fill.style.transform = scale;
      const signature = `${view.length.toFixed(3)}|${view.recoverMark.toFixed(3)}`;
      if (signature !== drawn) {
        drawn = signature;
        node.style.setProperty('--stamina-len', view.length.toFixed(3));
        base.style.left = `${(view.baseEnd * 100).toFixed(1)}%`;
        mark.style.left = `${(view.recoverMark * 100).toFixed(1)}%`;
      }
      toggle(node, 'stamina--winded', view.winded);
      toggle(node, 'stamina--low', !view.winded && view.fill <= STAMINA_UI.lowShare);
      toggle(node, 'stamina--long', view.capacityBoost);
      toggle(node, 'stamina--quick', view.recoveryBoost);
      setAttr(node, 'aria-label', ariaOf(view));
    },
    dispose() {
      node.remove();
    },
  };
}
