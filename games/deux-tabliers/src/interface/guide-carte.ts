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
.dt-guide li.dt-guide-chapter { color: var(--dt-or); font-weight: 600; margin-top: 0.15em; }
.dt-guide .dt-guide-opt { font-size: 0.85em; opacity: 0.75; font-weight: 400; }
@container dt-hud (max-height: 34em) { .dt-guide ol { display: none; } }
`;

export interface GuideCard {
  update(guide: GuideView | null, full: boolean): void;
  dispose(): void;
}

function plainSteps(guide: GuideView): HTMLElement[] {
  return guide.steps.map((s, i) =>
    h(
      'li',
      { class: i < guide.current ? 'done' : i === guide.current ? 'now' : null },
      `${i < guide.current ? '✓' : i === guide.current ? '▸' : '·'} ${s.label}`,
    ),
  );
}

/**
 * Guide d'installation (démo v0.3): un chapitre fini se replie en une ligne cochée; le chapitre
 * en cours montre ses étapes, chacune cochée d'après le monde; les suivants, leur titre.
 */
function chapterSteps(guide: GuideView): HTMLElement[] {
  const current = guide.steps[guide.current]?.chapter ?? null;
  const out: HTMLElement[] = [];
  const chapters = [...new Set(guide.steps.map((s) => s.chapter ?? ''))];
  for (const chapter of chapters) {
    const steps = guide.steps.filter((s) => (s.chapter ?? '') === chapter);
    // Fini: toutes ses étapes obligatoires cochées; un chapitre tout facultatif, toutes cochées.
    const required = steps.filter((s) => s.optional !== true);
    const done = (required.length > 0 ? required : steps).every((s) => s.done === true);
    if (chapter !== current) {
      out.push(h('li', { class: done ? 'done' : null }, `${done ? '✓' : '·'} ${chapter}`));
      continue;
    }
    out.push(h('li', { class: 'dt-guide-chapter' }, chapter));
    for (const s of steps) {
      const now = guide.steps[guide.current] === s;
      out.push(
        h(
          'li',
          { class: s.done === true ? 'done' : now ? 'now' : null },
          `  ${s.done === true ? '✓' : now ? '▸' : '·'} ${s.label}`,
          s.optional === true ? h('span', { class: 'dt-guide-opt' }, ' · facultatif') : '',
        ),
      );
    }
  }
  return out;
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
        guide === null
          ? ''
          : JSON.stringify([
              full,
              guide.say,
              guide.current,
              guide.recipe,
              guide.title,
              guide.steps.map((s) => [s.label, s.done]),
            ]);
      if (key === painted) return;
      painted = key;
      card.hidden = guide === null;
      if (guide === null) return;
      const title = full
        ? (guide.title ?? 'Simone te guide · premier service')
        : `Recette : ${guide.recipe ?? 'en cours'}`;
      const steps = guide.title === undefined ? plainSteps(guide) : chapterSteps(guide);
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
