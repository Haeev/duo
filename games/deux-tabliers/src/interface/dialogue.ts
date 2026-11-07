/**
 * Répliques des habitués et scènes d'événements (ux 4.8, demo 5).
 * - Réplique: bulle en bas au centre, au-dessus des mains, texte à la taille de l'interface.
 *   Réplique simple: le pointeur reste verrouillé, E ou clic pour la suite. Réponses à choisir:
 *   l'interface rend le curseur (calque « réponses »), flèches et Entrée, Retour arrière
 *   « Au revoir ».
 * - Scène: carte au centre haut, sous les alertes, jamais de focus volé. L'indice privé
 *   (D-08) n'existe que chez le joueur concerné, marqué « Visible chez toi seulement ».
 */
import type { LayerSpec } from './calques';
import type { UiContext } from './contexte';
import { button, h, icon, keycap } from './dom';
import type { DialogueView, EventSceneView } from './modele';
import { T } from './textes';

export interface DialogueOverlay {
  update(dialogue: DialogueView | null, scene: EventSceneView | null, actKey: string): void;
  dispose(): void;
}

export function createDialogueOverlay(root: HTMLElement): DialogueOverlay {
  const bubble = h('div', { class: 'dt-bubble dt-card', role: 'status', 'aria-live': 'polite' });
  const scene = h('div', {
    class: 'dt-card',
    style: 'position: absolute; left: 50%; top: 9.5em; transform: translateX(-50%); width: 21em',
    role: 'status',
  });
  bubble.hidden = true;
  scene.hidden = true;
  root.append(bubble, scene);
  let lastDialogue = '';
  let lastScene = '';

  return {
    update(d, s, actKey) {
      const dk = JSON.stringify([d, actKey]);
      if (dk !== lastDialogue) {
        lastDialogue = dk;
        bubble.hidden = d === null;
        bubble.replaceChildren();
        if (d !== null) {
          bubble.append(
            h('div', { class: 'dt-bubble-who' }, d.speaker),
            h('div', { class: 'dt-bubble-text' }, `« ${d.text} »`),
          );
          if (d.privateHint !== null) bubble.append(privateHint(d.privateHint));
          bubble.append(
            h(
              'div',
              { class: 'dt-second' },
              d.answers.length === 0 ? keycap(actKey) : keycap('Entrée'),
              d.answers.length === 0 ? ` ${T.dialogue.next}` : ' répondre',
            ),
          );
        }
      }
      const sk = JSON.stringify(s);
      if (sk !== lastScene) {
        lastScene = sk;
        scene.hidden = s === null;
        scene.replaceChildren();
        if (s !== null) {
          scene.append(
            h(
              'strong',
              { style: 'display: block; font-family: var(--dt-titre); font-size: 1.1em' },
              s.title,
            ),
          );
          for (const line of s.lines) scene.append(h('div', null, line));
          if (s.privateHint !== null) scene.append(privateHint(s.privateHint));
          if (s.outcome !== null) {
            scene.append(
              h(
                'div',
                { class: 'dt-ok', style: 'margin-top: 0.4em; font-weight: 700' },
                icon('check'),
                s.outcome === 'formidable' ? T.scene.formidable : T.scene.reussi,
              ),
            );
            for (const r of s.rewards) scene.append(h('div', { class: 'dt-second' }, r));
            scene.append(h('div', { class: 'dt-second' }, keycap('Entrée'), T.scene.continue));
          }
        }
      }
    },
    dispose() {
      bubble.remove();
      scene.remove();
    },
  };
}

function privateHint(text: string): HTMLElement {
  return h(
    'div',
    { class: 'dt-private' },
    icon('info'),
    h(
      'span',
      null,
      h('strong', { style: 'display: block; font-size: 0.85em' }, T.dialogue.onlyYou),
      text,
    ),
  );
}

/** Calque des réponses: le curseur est rendu le temps de choisir (ux 4.8). */
export function answersLayer(ctx: UiContext, dialogue: DialogueView): LayerSpec {
  return {
    id: 'reponses',
    narrow: true,
    render(root) {
      const body = h(
        'div',
        { class: 'dt-panel-body' },
        h('h2', { class: 'dt-bubble-who', style: 'font-size: 1.1em' }, dialogue.speaker),
        h('p', { style: 'font-size: 1.1em' }, `« ${dialogue.text} »`),
        dialogue.privateHint === null ? null : privateHint(dialogue.privateHint),
      );
      const list = h('div', {
        style: 'display: flex; flex-direction: column; gap: 0.4em; margin-top: 0.6em',
      });
      dialogue.answers.forEach((answer, i) => {
        const b = button(
          answer,
          () => {
            ctx.send({ type: 'dialogue-answer', id: dialogue.id, answer: i });
            ctx.layers.close('reponses');
          },
          { primary: i === 0 },
        );
        if (i === 0) b.dataset.default = '';
        list.append(b);
      });
      list.append(
        button(T.dialogue.bye, () => {
          ctx.layers.close('reponses');
        }),
      );
      body.append(list, h('p', { class: 'dt-second' }, T.dialogue.choose));
      root.append(body);
    },
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}
