/**
 * Carte « À faire » du guide de Simone (retours du 2026-11-08), à gauche de l'écran: ce que dit
 * Simone, puis les étapes du service en cours, cochées quand elles sont faites. Le premier jour
 * ouvert, elle suit tout le service; ensuite, elle redit la recette du ticket qu'on a pris (aide
 * de recette). Repeinte seulement quand son contenu change.
 */
import type { GuideView } from '../branchement/guide';
import { h } from './dom';

const STYLE = `
.dt-guide-layer { z-index: 11; }
.dt-guide { position: absolute; left: 1em; top: 13em; width: 16em; display: flex; flex-direction: column; gap: 0.35em; border-color: var(--dt-or); }
.dt-guide h3 { margin: 0; font: 600 0.95em var(--dt-titre); color: var(--dt-or); }
.dt-guide .dt-guide-say { margin: 0; font-size: 0.95em; }
.dt-guide ol { margin: 0; padding: 0; list-style: none; font-size: 0.85em; display: flex; flex-direction: column; gap: 0.15em; }
.dt-guide li { color: var(--dt-creme-2); }
.dt-guide li.done { text-decoration: line-through; opacity: 0.7; }
.dt-guide li.now { color: var(--dt-creme); font-weight: 600; }
@container dt-hud (max-height: 34em) { .dt-guide ol { display: none; } }
`;

export interface GuideCard {
  update(guide: GuideView | null, full: boolean): void;
  dispose(): void;
}

export function createGuideCard(root: HTMLElement): GuideCard {
  const style = h('style', null, STYLE);
  const layer = h('div', { class: 'dt-hud dt-guide-layer' });
  const card = h('section', { class: 'dt-card dt-guide', 'aria-live': 'polite' });
  card.hidden = true;
  layer.append(card);
  root.append(style, layer);
  let painted = '';
  return {
    update(guide, full) {
      const key =
        guide === null ? '' : JSON.stringify([full, guide.say, guide.current, guide.recipe]);
      if (key === painted) return;
      painted = key;
      card.hidden = guide === null;
      if (guide === null) return;
      const title = full
        ? 'Simone te guide · premier service'
        : `Recette : ${guide.recipe ?? 'en cours'}`;
      const steps = guide.steps.map((s, i) =>
        h(
          'li',
          { class: i < guide.current ? 'done' : i === guide.current ? 'now' : null },
          `${i < guide.current ? '✓' : i === guide.current ? '▸' : '·'} ${s.label}`,
        ),
      );
      const parts: HTMLElement[] = [h('h3', null, title)];
      if (guide.say !== '') parts.push(h('p', { class: 'dt-guide-say' }, `« ${guide.say} »`));
      if (full && guide.recipe !== null)
        parts.push(h('div', { class: 'dt-second' }, `Commande : ${guide.recipe}`));
      parts.push(h('ol', null, ...steps));
      card.replaceChildren(...parts);
    },
    dispose() {
      layer.remove();
      style.remove();
    },
  };
}
