/**
 * Fenêtre de dialogue (interface.md, 5.2): bandeau bas avec portrait, nom, texte accordé
 * (`talkView`) écrit lettre par lettre, trois lignes au plus par page; Espace affiche tout puis
 * continue; choix aux flèches et Entrée; option qui échouera marquée d'avance. Garde des choix
 * (`garde-choix.ts`): inactifs un instant à leur apparition, Entrée seule pour une décision à deux.
 */
import type { Content } from '../donnees/charger';
import type { TalkView } from '../simulation/dialogues/conversation';
import type { Intent } from '../simulation/noyau/entrees';
import { el, icon, onPointerHover, setText, show, toggle } from './dom';
import { choiceKeyOutcome } from './garde-choix';
import { paginate, Typewriter } from './modeles';
import { moodOfEmote, portraitMarkup } from './portrait';
import { UI_TUNING } from './reglages';
import { blockedText, TEXTS } from './textes';

export interface BabbleInfo {
  readonly villager: string;
  readonly char: string;
}

export interface DialogueWindow {
  /**
   * La vue du dialogue de ce joueur (`null`: fermé). `decision`: les choix offrent une décision à
   * deux (`isDecisionChoice`), qui ne se valide qu'avec Entrée ou un clic.
   */
  sync(view: TalkView | null, now: number, decision?: boolean): void;
  frame(dtMs: number): void;
  isOpen(): boolean;
  /** Touche lue par la fenêtre (vrai: consommée). */
  key(code: string, now: number): boolean;
  choose(index: number): void;
  /** L'hôte a refusé le choix (le nœud reste): on peut choisir de nouveau. */
  unlock(): void;
  dispose(): void;
}

/** Ce qui, dans les options, change l'affichage sans changer de nœud. */
function optionsKey(view: TalkView): string {
  return view.options.map((o) => `${o.id}:${o.blocked ?? ''}:${o.fails ?? ''}`).join('|');
}

export function createDialogue(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  reduced: () => boolean,
  onBabble: (info: BabbleInfo) => void,
  openGuardMs: number,
  /** Nom de l'autre joueur, pour les raisons « chez l'autre » d'une option impossible. */
  otherName: () => string = () => '',
): DialogueWindow {
  const bust = el('div', { class: 'dlg__bust' });
  const provisional = el('span', {
    class: 'provisoire provisoire--bust',
    text: TEXTS.dialogue.provisional,
  });
  const name = el('div', { class: 'dlg__plate' });
  const text = el('p', { class: 'dlg__text', 'aria-live': 'polite' });
  const nextKey = el('span', { class: 'key' });
  const next = el('div', { class: 'dlg__next' }, [nextKey, el('i')]);
  const band = el('section', { class: 'dlg' }, [bust, provisional, name, text, next]);
  const choices = el('div', {
    class: 'choices',
    role: 'listbox',
    'aria-label': TEXTS.dialogue.choices,
  });
  const layer = el('div', { class: 'dialogue' }, [choices, band]);
  layer.hidden = true;
  root.append(layer);

  let current: TalkView | null = null;
  let villager = '';
  let pages: string[] = [];
  let page = 0;
  let focus = 0;
  let openedAt = 0;
  /** Une intention est partie: on attend le nœud suivant sans renvoyer. */
  let pending = false;
  /** Garde des choix (`garde-choix.ts`): instant d'apparition, armés, décision à deux, rappel. */
  let shownAt = 0;
  let armed = false;
  let decision = false;
  let remindUntil = 0;
  const writer = new Typewriter((char) => {
    onBabble({ villager, char });
  });

  function startPage(): void {
    writer.start(pages[page] ?? '', reduced());
    setText(text, writer.visible);
  }

  /** Option impossible choisie: sa raison ressort un instant (rien n'est envoyé, l'échange échouerait). */
  let triedUntil = 0;
  let triedId = '';
  let clock = 0;

  function drawChoices(): void {
    choices.replaceChildren();
    const options = current?.options ?? [];
    options.forEach((option, i) => {
      const blocked = option.blocked;
      const why = blocked === null ? null : blockedText(blocked, otherName());
      const classes = [
        'choice',
        i === focus ? 'focus' : '',
        // Une option impossible prend l'habillage des options qui échoueront (tirets, texte atténué).
        option.fails !== null || blocked !== null ? 'choice--fails' : '',
        blocked !== null ? 'choice--blocked' : '',
        blocked !== null && option.id === triedId && clock < triedUntil ? 'choice--tried' : '',
      ];
      const button = el(
        'button',
        {
          class: classes.filter(Boolean).join(' '),
          role: 'option',
          'aria-selected': i === focus ? 'true' : 'false',
          'aria-disabled': blocked === null ? null : 'true',
          'aria-label':
            why === null ? null : `${option.text}. ${TEXTS.dialogue.blockedLabel}\u00a0: ${why}`,
          title: option.fails !== null ? TEXTS.dialogue.fails : null,
          tabindex: '-1',
        },
        [
          option.fails !== null ? el('span', { class: 'barre' }, [icon('goutte')]) : null,
          blocked !== null ? el('span', { class: 'barre' }, [icon('refus')]) : null,
          why === null
            ? option.text
            : el('span', { class: 'choice__body' }, [
                el('span', { class: 'choice__text', text: option.text }),
                el('span', {
                  class: 'choice__why',
                  text: why,
                }),
              ]),
        ],
      );
      button.addEventListener('click', () => {
        api.choose(i);
      });
      onPointerHover(button, () => {
        if (focus === i) return;
        focus = i;
        drawChoices();
      });
      choices.append(button);
    });
    const visible = options.length > 0 && writer.done;
    // Les choix apparaissent: la garde commence, Espace et Entrée n'y valident encore rien.
    if (visible && choices.hidden) {
      shownAt = clock;
      armed = false;
    }
    if (options.length > 0) choices.append(hintNode());
    show(choices, visible);
    markChoices();
  }

  /** La touche qui valide, sous les choix: Entrée pour une décision à deux, sinon Espace. */
  function hintNode(): HTMLElement {
    return el('p', { class: 'choices-hint', 'aria-hidden': 'true' }, [
      el('span', { class: 'key', text: keyLabel(decision ? 'Enter' : 'Space') }),
      el('span', {
        class: 'choices-hint__text',
        text: decision ? TEXTS.dialogue.decide : TEXTS.dialogue.choose,
      }),
    ]);
  }

  /** États visibles de la garde: inactifs (atténués), prêts, décision, rappel de la touche. */
  function markChoices(): void {
    toggle(choices, 'choices--garde', !armed);
    toggle(choices, 'choices--pret', armed);
    toggle(choices, 'choices--decision', decision);
    toggle(choices, 'choices--rappel', clock < remindUntil);
    choices.style.setProperty('--garde', `${String(UI_TUNING.choiceGuardMs)}ms`);
    choices.setAttribute(
      'aria-label',
      decision ? TEXTS.dialogue.choicesDecision : TEXTS.dialogue.choices,
    );
  }

  /** Espace ou Entrée sur les choix affichés, selon la garde (`garde-choix.ts`). */
  function validate(code: string): void {
    const outcome = choiceKeyOutcome(code, clock - shownAt, UI_TUNING.choiceGuardMs, decision);
    if (outcome === 'choose') api.choose(focus);
    else if (outcome === 'remind') {
      remindUntil = clock + UI_TUNING.decisionHintMs;
      markChoices();
    }
  }

  const api: DialogueWindow = {
    sync(view, now, isDecision = false) {
      if (view === null) {
        if (current !== null) {
          current = null;
          layer.hidden = true;
        }
        return;
      }
      if (current !== null && current.node === view.node && current.villager === view.villager) {
        // Même nœud: seules les raisons d'impossibilité ont pu changer (argent, poches).
        if (optionsKey(view) !== optionsKey(current)) {
          current = view;
          drawChoices();
        }
        return;
      }
      const opening = current === null;
      current = view;
      pending = false;
      villager = view.villager;
      if (opening) {
        openedAt = now;
        layer.hidden = false;
        bust.innerHTML = portraitMarkup(view.villager);
        const def = Object.values(content.places)
          .flatMap((p) => p.villagers)
          .find((v) => v.id === view.villager);
        setText(name, def?.name ?? view.villager);
      }
      focus = 0;
      // Nœud nouveau: ses choix repartent cachés, donc avec une garde neuve.
      decision = isDecision;
      remindUntil = 0;
      show(choices, false);
      // Expression du portrait: l'émotion de la réplique, quand c'est l'habitant qui parle.
      bust.setAttribute(
        'data-expr',
        view.speaker === view.villager ? moodOfEmote(view.emote) : 'neutre',
      );
      // Un choix garde la dernière réplique à l'écran: on lit la question en répondant.
      if (view.text !== null) {
        pages = paginate(view.text);
        page = 0;
        startPage();
      } else writer.revealAll();
      setText(nextKey, keyLabel('Space'));
      drawChoices();
    },
    frame(dtMs) {
      clock += dtMs;
      if (current === null) return;
      if (triedId !== '' && clock >= triedUntil) {
        triedId = '';
        drawChoices();
      }
      if (!armed && !choices.hidden && clock - shownAt >= UI_TUNING.choiceGuardMs) {
        armed = true;
        markChoices();
      }
      if (remindUntil !== 0 && clock >= remindUntil) {
        remindUntil = 0;
        markChoices();
      }
      if (writer.advance(dtMs)) setText(text, writer.visible);
      const typing = !writer.done;
      toggle(bust, 'parle', typing);
      show(next, !typing && current.options.length === 0);
      if (!typing && choices.hidden && current.options.length > 0) drawChoices();
    },
    isOpen() {
      return current !== null;
    },
    key(code, now) {
      if (current === null) return false;
      if (now - openedAt < openGuardMs) return true;
      const options = current.options;
      if (code === 'Space') {
        if (!writer.done) {
          writer.revealAll();
          setText(text, writer.visible);
          drawChoices();
        } else if (page + 1 < pages.length) {
          page += 1;
          startPage();
        } else if (options.length > 0) validate(code);
        else if (!pending) {
          pending = true;
          send({ type: 'talk_next' });
        }
        return true;
      }
      if (options.length > 0 && writer.done) {
        if (code === 'ArrowUp' || code === 'KeyW')
          focus = (focus + options.length - 1) % options.length;
        else if (code === 'ArrowDown' || code === 'KeyS') focus = (focus + 1) % options.length;
        else if (code === 'Enter') validate(code);
        drawChoices();
      }
      if (code === 'Backspace' && !pending) {
        pending = true;
        send({ type: 'talk_close' });
      }
      return true;
    },
    choose(index) {
      const option = current?.options[index];
      if (option === undefined || pending || !writer.done) return;
      if (option.blocked !== null) {
        // L'échange échouerait: on n'envoie rien, la raison déjà écrite ressort un instant.
        triedId = option.id;
        triedUntil = clock + 1400;
        drawChoices();
        return;
      }
      pending = true;
      send({ type: 'talk_choose', option: option.id });
    },
    unlock() {
      pending = false;
    },
    dispose() {
      layer.remove();
    },
  };
  return api;
}
