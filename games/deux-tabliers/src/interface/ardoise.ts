/**
 * L'ardoise (CC08, ux 4.3, maquette `ardoise.html`): composer la carte et les prix, à deux.
 * À gauche « Vos recettes » par famille, à droite la planche à la craie (compteur, mot du jour,
 * lignes avec prix par pas de 10 centimes, vedette, « Effacer », avis de prix), puis le résumé.
 * Une ligne touchée par l'autre se verrouille à sa couleur et à son symbole. Café ouvert:
 * lecture seule, une recette en rupture se grise toute seule.
 */
import type { LayerSpec } from './calques';
import { footer } from './calques';
import type { UiContext } from './contexte';
import { button, h, icon, token } from './dom';
import type { RecipeView, SlateLineView, SlateView } from './modele';
import { T } from './textes';
import { euros, fill } from './typo';

/** Bornes de prix autour du prix conseillé (cahier AT-03: de -30 % à +50 %). */
const PRICE_MIN = 0.7;
const PRICE_MAX = 1.5;
const PRICE_STEP = 10;

export function slateLayer(ctx: UiContext): LayerSpec {
  let holding: string | null = null;
  const hold = (recipe: string | null): void => {
    if (holding === recipe) return;
    holding = recipe;
    ctx.send({ type: 'slate-hold', recipe });
  };

  return {
    id: 'ardoise',
    render(root) {
      const slate = ctx.model().slate;
      const partner = ctx.partner.name;
      root.append(
        h(
          'header',
          { class: 'dt-panel-head' },
          h('h2', null, T.slate.title),
          h('span', { class: 'dt-second' }, T.slate.intro),
        ),
      );
      const body = h('div', { class: 'dt-panel-body', 'data-scroll': 'ardoise' });
      root.append(body);
      if (slate === null) {
        body.append(h('p', null, T.slate.empty));
        root.append(slateFooter());
        return;
      }
      const full = slate.lines.length >= slate.maxLines;
      if (slate.readOnly)
        body.append(h('div', { class: 'dt-banner' }, icon('info'), T.slate.service));
      else if (slate.lines.length === 0)
        body.append(h('div', { class: 'dt-banner' }, icon('info'), T.slate.empty));
      else if (full) body.append(h('div', { class: 'dt-banner' }, icon('info'), T.slate.fullNote));
      else if (slate.proposedThisMorning)
        body.append(h('div', { class: 'dt-banner' }, icon('tablet'), T.slate.proposed));

      const board = boardElement(ctx, slate, partner, hold);
      if (slate.readOnly) {
        body.append(board);
      } else {
        body.append(h('div', { class: 'dt-slate' }, recipesElement(ctx, slate, full), board));
      }
      if (slate.summary !== null)
        body.append(h('p', { style: 'margin-top: 0.8em' }, slate.summary));
      root.append(slateFooter());
    },
    defaultFocus(root) {
      const slate = ctx.model().slate;
      if (slate === null) return null;
      if (slate.readOnly) return root.querySelector<HTMLElement>('[data-rescue]');
      if (slate.lines.length >= slate.maxLines)
        return root.querySelector<HTMLElement>('[data-erase]');
      return root.querySelector<HTMLElement>('[data-write]:not([disabled])');
    },
    onClose() {
      hold(null);
    },
  };
}

function slateFooter(): HTMLElement {
  return footer(
    [
      [['flèches', 'ou', 'Z', 'Q', 'S', 'D'], 'choisir'],
      [['Entrée'], 'écrire, effacer, changer le prix'],
      [['Retour arrière'], 'fermer (dans le mot du jour : effacer)'],
    ],
    T.slate.footer,
  );
}

function recipesElement(ctx: UiContext, slate: SlateView, full: boolean): HTMLElement {
  const col = h('div', null, h('h3', null, T.slate.recipes));
  const families: string[] = [];
  for (const r of slate.recipes) if (!families.includes(r.family)) families.push(r.family);
  for (const family of families) {
    col.append(h('h4', null, family));
    for (const r of slate.recipes.filter((x) => x.family === family))
      col.append(recipeRow(ctx, slate, r, full));
  }
  return col;
}

function recipeRow(ctx: UiContext, slate: SlateView, r: RecipeView, full: boolean): HTMLElement {
  const on = slate.lines.some((l) => l.recipe === r.id);
  let action: HTMLElement;
  if (on)
    action = h(
      'span',
      { class: 'dt-ok', style: 'color: var(--dt-creme)' },
      icon('check'),
      T.slate.onSlate,
    );
  else if (r.unavailable !== null)
    action = button(r.unavailable, () => undefined, { disabled: true });
  else if (full) action = button(T.slate.full, () => undefined, { disabled: true });
  else {
    action = button(
      T.slate.write,
      () => {
        ctx.send({ type: 'slate-write', recipe: r.id });
      },
      { name: `${T.slate.write} : ${r.name}` },
    );
    action.dataset.write = '';
  }
  return h(
    'div',
    { class: 'dt-recipe' },
    h(
      'div',
      null,
      h('strong', null, r.name),
      h(
        'div',
        { class: 'dt-second' },
        fill(T.slate.attracts, { price: euros(r.suggestedCents), who: r.attracts }),
      ),
    ),
    action,
  );
}

function boardElement(
  ctx: UiContext,
  slate: SlateView,
  partner: string,
  hold: (recipe: string | null) => void,
): HTMLElement {
  const stars = slate.lines.filter((l) => l.star).length;
  const board = h(
    'div',
    { class: 'dt-board' },
    h(
      'div',
      { class: 'dt-row', style: 'justify-content: space-between' },
      h('h3', null, T.slate.board),
      h(
        'span',
        { class: 'dt-second' },
        fill(T.slate.counter, {
          n: slate.lines.length,
          max: slate.maxLines,
          stars,
          maxStars: slate.maxStars,
        }),
      ),
    ),
  );
  if (slate.partnerWriting)
    board.append(
      h(
        'div',
        { class: 'dt-lock', style: 'margin: 0.3em 0' },
        token(ctx.partner.color),
        fill(T.slate.partnerWriting, { partner }),
      ),
    );
  if (!slate.readOnly) {
    const word = h('input', {
      class: 'dt-input',
      type: 'text',
      maxlength: 40,
      value: slate.word,
      placeholder: T.slate.wordPlaceholder,
      'aria-describedby': 'dt-word-help',
      'data-keep': 'mot-du-jour',
    });
    word.addEventListener('input', () => {
      ctx.send({ type: 'slate-word', text: word.value.slice(0, 40) });
    });
    board.append(
      h(
        'label',
        { style: 'display: block; margin: 0.6em 0 0.25em; font-weight: 700' },
        T.slate.word,
        word,
      ),
      h('div', { class: 'dt-second', id: 'dt-word-help' }, T.slate.wordHelp),
    );
  } else if (slate.word !== '') {
    board.append(h('p', { style: 'font: 1.4em/1.2 var(--dt-main)' }, slate.word));
  }
  if (slate.lines.length === 0) board.append(h('p', { class: 'dt-second' }, T.slate.empty));
  for (const line of slate.lines) board.append(lineElement(ctx, slate, line, stars, hold));
  return board;
}

function lineElement(
  ctx: UiContext,
  slate: SlateView,
  line: SlateLineView,
  stars: number,
  hold: (recipe: string | null) => void,
): HTMLElement {
  const recipe = slate.recipes.find((r) => r.id === line.recipe);
  const name = recipe?.name ?? line.recipe;
  const lower = name.toLowerCase();
  const locked = line.lockedBy !== null && line.lockedBy !== ctx.model().local;
  const disabled = locked || slate.readOnly;
  const suggested = recipe?.suggestedCents ?? line.priceCents;
  const min = Math.round((suggested * PRICE_MIN) / PRICE_STEP) * PRICE_STEP;
  const max = Math.round((suggested * PRICE_MAX) / PRICE_STEP) * PRICE_STEP;
  const setPrice = (cents: number): void => {
    ctx.send({
      type: 'slate-price',
      recipe: line.recipe,
      priceCents: Math.max(min, Math.min(max, cents)),
    });
  };
  const minus = button(
    '',
    () => {
      setPrice(line.priceCents - PRICE_STEP);
    },
    { name: fill(T.slate.lower, { item: lower }), disabled: disabled || line.priceCents <= min },
  );
  minus.append(icon('minus'));
  const plus = button(
    '',
    () => {
      setPrice(line.priceCents + PRICE_STEP);
    },
    { name: fill(T.slate.raise, { item: lower }), disabled: disabled || line.priceCents >= max },
  );
  plus.append(icon('plus'));
  const star = button(
    '',
    () => {
      ctx.send({ type: 'slate-star', recipe: line.recipe, star: !line.star });
    },
    {
      name: fill(T.slate.star, { item: lower }),
      disabled: disabled || (!line.star && stars >= slate.maxStars),
    },
  );
  star.setAttribute('aria-pressed', String(line.star));
  star.append(icon('star', undefined, line.star));
  const erase = button(
    T.slate.erase,
    () => {
      ctx.send({ type: 'slate-erase', recipe: line.recipe });
    },
    { name: `${T.slate.erase} : ${name}`, disabled },
  );
  erase.dataset.erase = '';
  const controls = h('div', { class: 'dt-row', style: 'gap: 0.4em; flex-wrap: nowrap' });
  if (slate.readOnly)
    controls.append(h('span', { class: 'dt-line-price' }, euros(line.priceCents)));
  else
    controls.append(
      minus,
      h('span', { class: 'dt-line-price' }, euros(line.priceCents)),
      plus,
      star,
      erase,
    );
  const el = h(
    'div',
    { class: `dt-line${line.soldOut !== null ? ' soldout' : ''}` },
    h('span', { class: 'dt-line-name' }, line.star ? '★ ' : '', name),
    controls,
    h('div', { class: 'dt-second' }, line.soldOut ?? line.priceNote),
  );
  if (locked)
    el.append(
      h(
        'div',
        { class: 'dt-lock', style: 'grid-column: 1 / -1; justify-self: start' },
        token(ctx.partner.color),
        fill(T.slate.lock, { partner: ctx.partner.name }),
      ),
    );
  if (line.soldOut !== null) {
    const rescue = button(T.slate.rescue, () => {
      ctx.openTablet('orders');
    });
    rescue.dataset.rescue = '';
    el.append(h('div', { style: 'grid-column: 1 / -1' }, rescue));
  }
  el.addEventListener('focusin', () => {
    if (!disabled) hold(line.recipe);
  });
  return el;
}
