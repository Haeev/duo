/**
 * Écrans de choix, en 2D par-dessus la scène, curseur visible (ux 1.4 à 1.9, 2.2):
 * première fois (l'annonce, notre maison à deux, toi au café, ton confort), le matin, le détail
 * d'une proposition (« On ouvre ? », achat), la nuit, la fin de démo et la lettre de René.
 * Toi à gauche, l'autre à droite. Le clic ou l'Entrée du bouton principal sert de geste pour
 * reprendre le pointeur à la fermeture (C20).
 */
import { focusElement, type LayerSpec } from './calques';
import type { UiContext } from './contexte';
import { button, h, icon, token } from './dom';
import type { LetterView, NightChoice, ProposalView } from './modele';
import { horizontalFov } from './reglages';
import { PLAYER_SYMBOLS } from './symboles';
import { T } from './textes';
import { euros, fill } from './typo';

/** Nom de la maison: lettres, chiffres, espace, apostrophe, trait d'union, « & » et point (ux 1.4). */
const HOUSE_NAME = /^[\p{L}\p{N} '’&.-]*$/u;
const HOUSE_MAX = 24;
const FIRST_NAME_MAX = 16;
export const SILHOUETTES = 4;

type FirstStep = 'poster' | 'house' | 'me' | 'comfort';

/** Vignette simple d'une silhouette (sans nom genré), tablier à la couleur du profil. */
function silhouette(index: number, apron: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'dt-avatar');
  svg.setAttribute('aria-hidden', 'true');
  const widths = [10, 12, 14, 11];
  const heads = [6, 5.5, 6.5, 6];
  const w = widths[index] ?? 12;
  const r = heads[index] ?? 6;
  const add = (tag: string, attrs: Readonly<Record<string, string>>): void => {
    const el = document.createElementNS(NS, tag);
    for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, val);
    svg.append(el);
  };
  add('circle', { cx: '20', cy: String(11 - (index % 2)), r: String(r), fill: '#CDBBA6' });
  add('path', {
    d: `M${String(20 - w)} 38 Q${String(20 - w)} 20 20 19 Q${String(20 + w)} 20 ${String(20 + w)} 38 Z`,
    fill: '#EEE6D6',
  });
  add('rect', {
    x: String(20 - w * 0.55),
    y: '24',
    width: String(w * 1.1),
    height: '14',
    rx: '2',
    fill: apron,
  });
  return svg;
}

export function firstTimeLayer(ctx: UiContext, onDone: () => void): LayerSpec {
  let step: FirstStep = 'poster';
  let name = ctx.model().houseSetup?.name ?? '';
  let localReady = false;
  let firstName = ctx.me.name.slice(0, FIRST_NAME_MAX);
  let look = 0;
  let meReady = false;
  // Le passage automatique à l'étape suivante n'a lieu qu'une fois (Retour arrière y revient).
  let houseDone = false;
  const partner = ctx.partner.name;

  const go = (next: FirstStep): void => {
    step = next;
    ctx.layers.refresh('premiere-fois');
    const target = document.querySelector<HTMLElement>(
      '[data-layer="premiere-fois"] [data-default]',
    );
    if (target !== null) focusElement(target);
  };

  const nameError = (value: string): string | null => {
    if (value.trim().length === 0) return T.first.houseEmpty;
    if (!HOUSE_NAME.test(value)) return T.first.houseBadChar;
    return null;
  };

  return {
    id: 'premiere-fois',
    modal: true,
    narrow: true,
    render(root) {
      const model = ctx.model();
      const setup = model.houseSetup;
      const body = h('div', { class: 'dt-panel-body' });
      if (step === 'poster') {
        const next = button(
          T.first.continue,
          () => {
            go('house');
          },
          { primary: true },
        );
        next.dataset.default = '';
        body.append(
          h(
            'div',
            { class: 'dt-poster' },
            h('strong', null, T.first.posterTitle),
            h('p', null, T.first.posterText),
          ),
          h('p', { style: 'font-size: 1.1em' }, T.first.story),
          h('div', { class: 'dt-row', style: 'justify-content: flex-end' }, next),
        );
      } else if (step === 'house') {
        const ready = setup?.ready ?? [localReady, false];
        const me = model.local;
        const other = me === 0 ? 1 : 0;
        const editingBy = setup?.editingBy ?? null;
        const lockedByOther = editingBy !== null && editingBy !== me;
        const input = h('input', {
          class: 'dt-input',
          type: 'text',
          maxlength: HOUSE_MAX,
          value: setup?.name ?? name,
          placeholder: T.first.housePlaceholder,
          'data-keep': 'maison',
          'data-default': true,
          disabled: lockedByOther,
          'aria-describedby': 'dt-house-error',
        });
        const error = h('div', { class: 'dt-error', id: 'dt-house-error', role: 'alert' });
        const showError = (): void => {
          const e = nameError(input.value);
          error.replaceChildren(...(e === null ? [] : [icon('info'), e]));
        };
        input.addEventListener('input', () => {
          name = input.value;
          localReady = false;
          ctx.send({ type: 'house-name', name: name.slice(0, HOUSE_MAX) });
          showError();
        });
        input.addEventListener('focus', () => {
          ctx.send({ type: 'house-editing', editing: true });
        });
        input.addEventListener('blur', () => {
          ctx.send({ type: 'house-editing', editing: false });
        });
        const mineReady = ready[me];
        const ok = button(
          mineReady ? T.first.houseNotYet : T.first.houseReady,
          () => {
            if (!mineReady && nameError(input.value) !== null) {
              showError();
              return;
            }
            localReady = !mineReady;
            ctx.send({ type: 'house-ready', ready: localReady });
            // Sans état partagé (chantier b pas encore branché), on avance seul.
            if (setup === null && localReady) go('me');
            else ctx.layers.refresh('premiere-fois');
          },
          { primary: !mineReady },
        );
        if (lockedByOther)
          error.append(token(ctx.partner.color), fill(T.first.houseLock, { partner }));
        body.append(
          h('h2', null, T.first.houseTitle),
          h('p', null, T.first.houseText),
          h(
            'label',
            { style: 'display: block; font-weight: 700; margin-top: 0.6em' },
            T.first.houseField,
            input,
          ),
          error,
          h(
            'div',
            { class: 'dt-pair' },
            readyChip(ctx.me.color, ctx.me.name, ready[me]),
            readyChip(ctx.partner.color, partner, ready[other]),
          ),
          h('div', { class: 'dt-row', style: 'justify-content: flex-end' }, ok),
          h('p', { class: 'dt-second' }, T.first.houseHelp),
          h('p', { class: 'dt-second' }, T.first.houseLater),
        );
        // La maison a son nom (l'autre a confirmé): on passe à la suite sans attendre de clic.
        const named = setup === null && model.clock !== null && model.clock.phase !== 'first-time';
        if (((setup !== null && setup.ready[0] && setup.ready[1]) || named) && !houseDone) {
          houseDone = true;
          queueMicrotask(() => {
            if (step === 'house') go('me');
          });
        }
      } else if (step === 'me') {
        const input = h('input', {
          class: 'dt-input',
          type: 'text',
          maxlength: FIRST_NAME_MAX,
          value: firstName,
          'data-keep': 'prenom',
          'data-default': true,
          'aria-describedby': 'dt-firstname-help',
        });
        input.addEventListener('input', () => {
          firstName = input.value;
        });
        const group = h('div', {
          class: 'dt-avatars',
          role: 'radiogroup',
          'aria-label': T.first.silhouette,
        });
        for (let i = 0; i < SILHOUETTES; i++) {
          const b = button(
            '',
            () => {
              look = i;
              ctx.layers.refresh('premiere-fois');
            },
            { name: fill(T.first.silhouetteN, { n: i + 1 }) },
          );
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(look === i));
          b.append(silhouette(i, PLAYER_SYMBOLS[ctx.me.color].color));
          group.append(b);
        }
        const go2 = button(
          meReady ? T.first.edit : T.first.go,
          () => {
            meReady = !meReady;
            ctx.send({
              type: 'avatar',
              firstName: firstName.trim().slice(0, FIRST_NAME_MAX) || ctx.me.name,
              look,
            });
            if (meReady) go('comfort');
            else ctx.layers.refresh('premiere-fois');
          },
          { primary: true },
        );
        body.append(
          h('h2', null, T.first.meTitle),
          h('p', null, fill(T.first.meText, { partner })),
          h('label', { style: 'display: block; font-weight: 700' }, T.first.firstName, input),
          h('div', { class: 'dt-second', id: 'dt-firstname-help' }, T.first.firstNameHelp),
          h('h4', null, T.first.silhouette),
          group,
          h(
            'p',
            { class: 'dt-row' },
            token(ctx.me.color),
            fill(T.first.apron, { profile: profileName(ctx.me.color) }),
          ),
          h('div', { class: 'dt-row', style: 'justify-content: flex-end' }, go2),
        );
      } else {
        const s = ctx.settings.get();
        const fov = h('input', { type: 'range', min: 50, max: 75, step: 5, value: s.fovDeg });
        const fovOut = h('output', null, `${String(horizontalFov(s.fovDeg, ctx.aspect()))}°`);
        fov.addEventListener('input', () => {
          ctx.settings.set('fovDeg', Number(fov.value));
          fovOut.textContent = `${String(horizontalFov(Number(fov.value), ctx.aspect()))}°`;
        });
        const sens = h('input', {
          type: 'range',
          min: 0.2,
          max: 3,
          step: 0.1,
          value: s.sensitivity,
        });
        const sensOut = h('output', null, s.sensitivity.toFixed(1).replace('.', ','));
        sens.addEventListener('input', () => {
          ctx.settings.set('sensitivity', Number(sens.value));
          sensOut.textContent = Number(sens.value).toFixed(1).replace('.', ',');
        });
        const simple = button(s.simplifiedGestures ? T.settings.on : T.settings.off, () => {
          ctx.settings.set('simplifiedGestures', !ctx.settings.get().simplifiedGestures);
          ctx.layers.refresh('premiere-fois');
        });
        simple.setAttribute('role', 'switch');
        simple.setAttribute('aria-checked', String(s.simplifiedGestures));
        const go3 = button(
          T.first.go,
          () => {
            ctx.layers.close('premiere-fois');
            onDone();
          },
          { primary: true },
        );
        go3.dataset.default = '';
        body.append(
          h('h2', null, T.first.comfortTitle),
          h('p', null, T.first.comfortText),
          h('h4', null, T.settings.view),
          h(
            'div',
            { class: 'dt-setting' },
            h('span', null, T.settings.fov),
            h('span', { class: 'dt-row' }, fov, fovOut),
            h('div', { class: 'dt-second' }, T.settings.fovHelp),
          ),
          h('h4', null, T.settings.mouse),
          h(
            'div',
            { class: 'dt-setting' },
            h('span', null, T.settings.sensitivity),
            h('span', { class: 'dt-row' }, sens, sensOut),
          ),
          h('h4', null, T.settings.gestures),
          h(
            'div',
            { class: 'dt-setting' },
            h('span', null, T.settings.simplified),
            simple,
            h('div', { class: 'dt-second' }, fill(T.settings.simplifiedHelp, { partner })),
          ),
          h('div', { class: 'dt-row', style: 'justify-content: flex-end; margin-top: 0.8em' }, go3),
        );
      }
      root.append(body);
    },
    back() {
      // Retour arrière revient à l'étape précédente, hors d'un champ (ux 1.4).
      const order: readonly FirstStep[] = ['poster', 'house', 'me', 'comfort'];
      const i = order.indexOf(step);
      const prev = order[i - 1];
      if (prev !== undefined) go(prev);
      return true;
    },
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}

function readyChip(color: Parameters<typeof token>[0], name: string, ready: boolean): HTMLElement {
  return h(
    'div',
    { class: 'dt-who' },
    token(color),
    h('strong', null, name),
    h(
      'span',
      { class: `dt-chip${ready ? '' : ' dashed'}`, style: 'margin-left: auto' },
      ready ? icon('check') : null,
      ready ? T.first.chipReady : T.first.chipNotYet,
    ),
  );
}

function profileName(color: Parameters<typeof token>[0]): string {
  const names: Readonly<Record<string, string>> = {
    orb: 'astre aqua',
    crescent: 'croissant mauve',
    star: 'étoile anis',
    sun: 'soleil corail',
    planet: 'planète rose',
    comet: 'comète jade',
  };
  return names[color] ?? color;
}

export function morningLayer(ctx: UiContext, onStart: () => void): LayerSpec {
  return {
    id: 'matin',
    modal: true,
    narrow: true,
    render(root) {
      const m = ctx.model().morning;
      const body = h('div', { class: 'dt-panel-body' });
      if (m === null) {
        body.append(h('p', null, T.morning.nothing));
      } else {
        body.append(
          h(
            'div',
            { class: 'dt-row', style: 'justify-content: space-between' },
            h('h2', null, m.title),
            h(
              'span',
              { class: 'dt-row' },
              icon(
                m.weather.kind === 'sun' ? 'sun' : m.weather.kind === 'clouds' ? 'clouds' : 'rain',
              ),
              m.weather.label,
            ),
          ),
        );
        const block = (title: string, lines: readonly string[]): void => {
          body.append(h('h4', null, title));
          if (lines.length === 0) body.append(h('p', { class: 'dt-second' }, T.morning.nothing));
          for (const l of lines) body.append(h('p', null, l));
        };
        block(T.morning.thisMorning, m.thisMorning);
        block(T.morning.today, m.today);
        if (m.projects.length > 0) block(T.morning.projects, m.projects);
        if (m.letter !== null) {
          const letter = m.letter;
          body.append(
            h('h4', null, T.morning.mail),
            h(
              'p',
              { class: 'dt-row' },
              icon('letter'),
              letter.title,
              button(T.letter.read, () => {
                ctx.layers.open(
                  letterLayer(letter, () => {
                    ctx.layers.close('lettre');
                  }),
                );
              }),
            ),
          );
        }
      }
      const start = button(
        T.morning.start,
        () => {
          ctx.send({ type: 'morning-start' });
          ctx.layers.close('matin');
          onStart();
        },
        { primary: true },
      );
      start.dataset.default = '';
      body.append(
        h('div', { class: 'dt-row', style: 'justify-content: flex-end; margin-top: 0.6em' }, start),
      );
      root.append(body);
    },
    back: () => true,
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}

/** Détail d'une proposition (CC07): focus par défaut sur l'acceptation. */
export function proposalLayer(ctx: UiContext, id: string): LayerSpec {
  return {
    id: 'proposition',
    narrow: true,
    render(root) {
      const p: ProposalView | undefined = ctx.model().proposals.find((x) => x.id === id);
      const partner = ctx.partner.name;
      const body = h('div', { class: 'dt-panel-body' });
      root.append(body);
      if (p === undefined) {
        body.append(h('p', null, fill(T.proposal.waiting, { partner })));
        return;
      }
      const answer = (accept: boolean): void => {
        ctx.send({ type: 'proposal-answer', id, accept });
        ctx.layers.close('proposition');
      };
      let yes: HTMLButtonElement;
      if (p.kind === 'open' || p.kind === 'close-early') {
        const open = p.kind === 'open';
        body.append(
          h('h2', null, open ? T.proposal.openTitle : T.proposal.closeTitle),
          h(
            'p',
            null,
            open ? fill(T.proposal.openLine, { partner }) : fill(T.proposal.closeLine, { partner }),
          ),
          h('p', { class: 'dt-second' }, open ? T.proposal.openDetail : T.proposal.closeDetail),
        );
        yes = button(
          open ? T.proposal.openYes : T.proposal.closeYes,
          () => {
            answer(true);
          },
          { primary: true },
        );
        body.append(
          h(
            'div',
            { class: 'dt-row' },
            yes,
            button(T.proposal.notYet, () => {
              answer(false);
            }),
          ),
        );
      } else {
        body.append(h('h2', null, fill(T.proposal.detailTitle, { partner, item: p.item ?? '' })));
        if (p.amountCents !== null)
          body.append(
            h(
              'p',
              null,
              fill(T.proposal.detailAmount, {
                amount: euros(p.amountCents, true),
                remaining: euros(p.remainingCents ?? 0, true),
              }),
            ),
          );
        if (p.benefit !== null) body.append(h('p', null, p.benefit));
        if (p.when !== null) body.append(h('p', { class: 'dt-second' }, p.when));
        yes = button(
          T.proposal.accept,
          () => {
            answer(true);
          },
          { primary: true },
        );
        body.append(
          h(
            'div',
            { class: 'dt-row' },
            yes,
            button(T.proposal.decline, () => {
              answer(false);
            }),
            button(T.proposal.seeCatalogue, () => {
              ctx.layers.close('proposition');
              ctx.openTablet('catalogue');
            }),
          ),
          h('p', { class: 'dt-second' }, T.proposal.help),
        );
      }
      yes.dataset.default = '';
    },
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}

export function nightLayer(ctx: UiContext): LayerSpec {
  return {
    id: 'nuit',
    modal: true,
    narrow: true,
    render(root) {
      const model = ctx.model();
      const n = model.night;
      const partner = ctx.partner.name;
      const me = model.local;
      const other = me === 0 ? 1 : 0;
      const mine: NightChoice = n?.choices[me] ?? 'none';
      const theirs: NightChoice = n?.choices[other] ?? 'none';
      const choose = (choice: NightChoice): void => {
        ctx.send({ type: 'night-choice', choice });
      };
      const cont = button(
        T.night.continue,
        () => {
          choose('continue');
        },
        { primary: true },
      );
      cont.setAttribute('aria-pressed', String(mine === 'continue'));
      cont.dataset.default = '';
      const fin = button(T.night.finish, () => {
        choose('finish');
      });
      fin.setAttribute('aria-pressed', String(mine === 'finish'));
      const chip = (c: NightChoice): string => T.night.chips[c];
      const body = h(
        'div',
        { class: 'dt-panel-body' },
        h('h2', null, T.night.title),
        n === null ? null : h('p', { class: 'dt-second' }, n.subtitle),
        n === null ? null : h('p', null, n.tomorrow),
        h(
          'div',
          { class: 'dt-pair' },
          whoChip(ctx.me.color, ctx.me.name, chip(mine)),
          whoChip(ctx.partner.color, partner, chip(theirs)),
        ),
        mine !== 'none' && theirs === 'none'
          ? h('p', null, fill(T.night.waiting, { partner }))
          : null,
        mine === 'continue' && theirs === 'finish'
          ? h('p', null, fill(T.night.disagree, { partner }))
          : null,
        h('div', { class: 'dt-row', style: 'justify-content: flex-end' }, fin, cont),
        h('p', { class: 'dt-second' }, fill(T.night.help, { partner })),
      );
      root.append(body);
    },
    back: () => true,
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}

function whoChip(color: Parameters<typeof token>[0], name: string, text: string): HTMLElement {
  return h(
    'div',
    { class: 'dt-who' },
    token(color),
    h('strong', null, name),
    h('span', { class: 'dt-chip', style: 'margin-left: auto' }, text),
  );
}

export function demoEndLayer(ctx: UiContext): LayerSpec {
  return {
    id: 'fin-demo',
    modal: true,
    narrow: true,
    render(root) {
      const d = ctx.model().demoEnd;
      const stay = button(
        T.demoEnd.stay,
        () => {
          ctx.send({ type: 'demo-end', stay: true });
          ctx.layers.close('fin-demo');
        },
        { primary: true },
      );
      stay.dataset.default = '';
      root.append(
        h(
          'div',
          { class: 'dt-panel-body' },
          h('h2', null, T.demoEnd.title),
          h('p', { style: 'font-size: 1.1em' }, T.demoEnd.text),
          d === null
            ? null
            : h(
                'p',
                { class: 'dt-second' },
                fill(T.demoEnd.stats, { days: d.days, served: d.served, words: d.words }),
              ),
          h(
            'div',
            { class: 'dt-row', style: 'justify-content: flex-end' },
            button(T.demoEnd.toLounge, () => {
              ctx.send({ type: 'demo-end', stay: false });
            }),
            stay,
          ),
        ),
      );
    },
    back: () => true,
    defaultFocus(root) {
      return root.querySelector<HTMLElement>('[data-default]');
    },
  };
}

/** La lettre de René (courrier du matin, ou en main propre le soir de la fête). */
export function letterLayer(letter: LetterView, close: () => void): LayerSpec {
  const closeButton = button(T.letter.keep, close, { primary: true });
  return {
    id: 'lettre',
    narrow: true,
    render(root) {
      root.append(
        h(
          'header',
          { class: 'dt-panel-head' },
          h('h2', null, letter.title),
          h('span', { class: 'dt-second' }, letter.from),
        ),
        h(
          'div',
          { class: 'dt-panel-body' },
          h(
            'div',
            { class: 'dt-letter' },
            ...letter.paragraphs.map((p) => h('p', null, p)),
            h('p', { style: 'text-align: right' }, letter.signature),
          ),
          h(
            'div',
            { class: 'dt-row', style: 'justify-content: flex-end; margin-top: 0.8em' },
            closeButton,
          ),
        ),
      );
    },
    defaultFocus: () => closeButton,
  };
}
