/**
 * Écran de boutique (interface.md 5.4, maquette `maquettes/boutique.html`): le commerçant à
 * gauche, deux onglets Acheter et Vendre (A et E), la grille au centre, le détail à droite avec la
 * quantité (Q et D), le total et les prix déjà vus ailleurs (couronne sur le meilleur). Tout au
 * clavier; la souris reste un complément. Propre à chaque joueur.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import {
  allShops,
  shopSays,
  shopSaysRefusal,
  type ShopMoment,
} from '../../simulation/commerces/prix';
import { formatEuros } from '../../simulation/sac/argent';
import { el, icon } from '../dom';
import type { EditorPreviewFactory } from '../editeur/editeur';
import { EDITOR_TEXTS } from '../editeur/textes';
import { itemThumb } from '../pictos';
import { portraitMarkup } from '../portrait';
import { UI_TUNING } from '../reglages';
import { fill, refusalText } from '../textes';
import { shopModel, type ShopModel, type ShopTab, type ShopTile, type ShopUiState } from './modele';
import { SHOP_TEXTS, shopRefusalText } from './textes';
import './boutique.css';

const S =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
/** Pictos propres à la boutique (créations du studio, repris de la maquette). */
const SYMBOLS: Readonly<Record<string, string>> = {
  etagere: `<g ${S}><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18M7 6h3M14 12h3M7 18h4"/></g>`,
  fleche: `<path ${S} d="M4 12h15M13 6l6 6-6 6"/>`,
  couronne: `<path fill="#e8c77a" stroke="#2a2522" stroke-width="1.8" stroke-linejoin="round" d="M3 18l1.5-10 5 5L12 5l2.5 8 5-5L21 18z"/>`,
  moins: `<path ${S} d="M5 12h14"/>`,
  plus: `<path ${S} d="M5 12h14M12 5v14"/>`,
  echoppe: `<g ${S}><path d="M3 10l2-6h14l2 6M4 10v10h16V10M3 10h18M9 20v-6h6v6"/></g>`,
  parole: `<g ${S}><path d="M4 5h16v10H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/></g>`,
  // Pièces de tenue, un picto par emplacement: repli tant que la vignette 3D n'est pas faite.
  'tenue-top': `<path ${S} d="M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3c-1 2-2 3-4 3S9 6 8 4z"/>`,
  'tenue-bottom': `<path ${S} d="M7 3h10l1 18h-4l-2-11-2 11H6z"/>`,
  'tenue-dress': `<path ${S} d="M9 3h6l-1 5 5 13H5l5-13z"/>`,
  'tenue-shoes': `<path ${S} d="M4 7h5c0 3 3 4 7 5 3 1 5 2 5 4v2H3v-3c0-3 1-5 1-8z"/>`,
  'tenue-hat': `<g ${S}><path d="M7 14c0-4 2-7 5-7s5 3 5 7"/><path d="M3 16c0-1 2-2 4-2h10c2 0 4 1 4 2s-4 2-9 2-9-1-9-2z"/></g>`,
  'tenue-accessory': `<g ${S}><path d="M5 5c3 2 11 2 14 0l1 3c-3 3-13 3-16 0z"/><path d="M13 9l2 11h-3l-1-11"/></g>`,
};
const COLUMNS = 6;

export interface ShopScreen {
  isOpen(): boolean;
  open(shop: string, now: number): void;
  close(): void;
  /** Événement de la simulation (déjà filtré au joueur local par l'appelant ou non). */
  onEvent(event: GameEvent, me: PlayerIndex, now: number): void;
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number): void;
  key(code: string, now: number): boolean;
  dispose(): void;
}

export function createShopScreen(
  root: HTMLElement,
  content: Content,
  send: (intent: Intent) => void,
  keyLabel: (code: string) => string,
  openGuardMs: number,
  reduced: () => boolean,
  /** Aperçu du personnage de l'éditeur: vignettes 3D des pièces de tenue. Absent: un picto. */
  preview?: EditorPreviewFactory,
): ShopScreen {
  const layer = el('div', { class: 'shop-layer' });
  layer.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(
    SYMBOLS,
  )
    .map(([id, body]) => `<symbol id="lpl-i-${id}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('')}</svg>`;
  layer.hidden = true;
  root.append(layer);
  // Un clic dans la boutique n'est pas un clic dans la scène.
  layer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  let ui: ShopUiState | null = null;
  let openedAt = 0;
  let drawn = '';
  let model: ShopModel | null = null;
  let message: { text: string; until: number; mood: 'yes' | 'no' | 'joy' } | null = null;
  let last: { world: ReadonlyWorld; me: PlayerIndex } | null = null;

  const shops = allShops(content);

  /**
   * Vignettes des pièces de tenue, faites par l'aperçu de l'éditeur (même rendu, même cadrage que
   * ses cases) sur la silhouette et la peau du joueur, puis l'aperçu est libéré aussitôt: aucun
   * contexte WebGL ne reste ouvert. Gardées pour la partie (adresses d'images de 128 px).
   */
  const pieceThumbs = new Map<string, string>();
  let thumbsBusy = false;
  let thumbsFailed = false;
  const thumbKey = (piece: string, shape: string, skin: number): string =>
    `${piece}|${shape}|${String(skin)}`;
  function lookOf(world: ReadonlyWorld, me: PlayerIndex): { shape: string; skin: number } {
    const state = world.players[me];
    // Sans apparence encore (démonstration), la silhouette de départ du jeu.
    const shape = state.look?.shape ?? content.settings.start.shapes[state.gender ?? 'f'];
    return { shape, skin: state.look?.skin ?? 0 };
  }
  function makeThumbs(world: ReadonlyWorld, me: PlayerIndex): void {
    if (preview === undefined || thumbsBusy || thumbsFailed || ui === null) return;
    const lines = shops.get(ui.shop)?.pieces ?? [];
    const { shape, skin } = lookOf(world, me);
    const missing = lines.filter((l) => !pieceThumbs.has(thumbKey(l.piece, shape, skin)));
    if (missing.length === 0) return;
    thumbsBusy = true;
    preview(document.createElement('canvas')).then(
      (ready) => {
        try {
          for (const line of missing) {
            const def = content.pieces[line.piece];
            if (def === undefined) continue;
            const defaults = content.morphologies.defaults[def.id] ?? [];
            const colors = def.zones.map((_, i) => defaults[i] ?? 0);
            const url = ready.thumbnail(
              { shape, skin, pieces: [{ slot: def.slot, id: def.id, colors }] },
              'piece',
            );
            pieceThumbs.set(thumbKey(def.id, shape, skin), url);
          }
        } finally {
          ready.dispose();
          thumbsBusy = false;
          drawn = '';
        }
      },
      () => {
        // Modèles absents (tests, repli): le picto de l'emplacement reste.
        thumbsBusy = false;
        thumbsFailed = true;
      },
    );
  }
  /** Image d'une case: l'objet, ou la vignette 3D de la pièce (à défaut son picto d'emplacement). */
  function tileImage(tile: ShopTile): string {
    if (tile.kind === 'item') return itemThumb(tile.item, tile.name);
    const look = last === null ? null : lookOf(last.world, last.me);
    const url =
      look === null ? undefined : pieceThumbs.get(thumbKey(tile.item, look.shape, look.skin));
    if (url !== undefined)
      return `<img class="obj obj--tenue" src="${url}" alt="" aria-hidden="true" draggable="false">`;
    const picto =
      `tenue-${tile.slot ?? ''}` in SYMBOLS ? `tenue-${tile.slot ?? ''}` : 'tenue-accessory';
    return `<svg class="obj obj--tenue-picto" aria-hidden="true"><use href="#lpl-i-${picto}"/></svg>`;
  }

  /** La réplique du commerçant de la boutique ouverte (sa fiche), à défaut le texte commun. */
  function keeperSays(moment: ShopMoment, common: string): string {
    const shop = ui === null ? undefined : shops.get(ui.shop);
    return (shop === undefined ? null : shopSays(shop, moment)) ?? common;
  }
  function keeperRefuses(reason: string): string {
    const shop = ui === null ? undefined : shops.get(ui.shop);
    return (
      (shop === undefined ? null : shopSaysRefusal(shop, reason)) ??
      shopRefusalText(reason) ??
      refusalText(reason)
    );
  }

  function setUi(patch: Partial<ShopUiState>): void {
    if (ui === null) return;
    ui = { ...ui, ...patch };
    if (last !== null) render(last.world, last.me, true);
  }

  function confirm(): void {
    const detail = model?.detail ?? null;
    if (ui === null || detail === null) return;
    if (detail.quantity === 0) {
      const reason =
        detail.tile.state === 'refused'
          ? 'not-wanted'
          : detail.tile.state === 'out-of-stock'
            ? 'out-of-stock'
            : detail.tile.state === 'owned'
              ? 'already-owned'
              : ui.tab === 'buy'
                ? 'not-enough-money'
                : 'shop-cap-reached';
      say(keeperRefuses(reason), 'no', performance.now());
      return;
    }
    if (detail.tile.kind === 'piece')
      send({ type: 'shop_buy_piece', shop: ui.shop, piece: detail.tile.item });
    else if (ui.tab === 'buy')
      send({
        type: 'shop_buy',
        shop: ui.shop,
        item: detail.tile.item,
        count: detail.quantity,
        chest: ui.chest,
      });
    else send({ type: 'shop_sell', shop: ui.shop, item: detail.tile.item, count: detail.quantity });
  }

  function say(text: string, mood: 'yes' | 'no' | 'joy', now: number): void {
    const { baseMs, perCharMs, maxMs } = UI_TUNING.shopSay;
    // Le temps de lire: une réplique de la fiche dure plus que le « Merci ! » commun.
    const shown = Math.min(maxMs, Math.max(baseMs, text.length * perCharMs));
    message = { text, until: now + shown, mood };
    drawn = '';
  }

  /** « Parler »: la conversation avec le commerçant, par-dessus le comptoir (intention `shop_talk`). */
  function talk(): void {
    if (ui !== null) send({ type: 'shop_talk', shop: ui.shop });
  }

  function keyChip(code: string): HTMLElement {
    return el('span', { class: 'key', text: keyLabel(code) });
  }

  function tileNode(tile: ShopTile, index: number, tab: ShopTab, keeperName: string): HTMLElement {
    const label =
      tab === 'buy'
        ? fill(SHOP_TEXTS.unitPrice, { objet: tile.name, prix: formatEuros(tile.unit ?? 0) }) +
          (tile.state === 'out-of-stock'
            ? SHOP_TEXTS.outOfStock
            : tile.state === 'too-expensive'
              ? fill(SHOP_TEXTS.tooExpensive, {
                  montant: formatEuros(
                    (tile.unit ?? 0) - (last?.world.players[last.me].money ?? 0),
                  ),
                })
              : '')
        : tile.state === 'refused'
          ? `${tile.name} : ${fill(SHOP_TEXTS.notWanted, { nom: keeperName })}`
          : fill(SHOP_TEXTS.unitOwned, {
              objet: tile.name,
              n: tile.owned,
              nom: keeperName,
              prix: formatEuros(tile.unit ?? 0),
            });
    const node = el('button', {
      class: `shop-tile shop-tile--${tile.state}${tile.kind === 'piece' ? ' shop-tile--piece' : ''}${model?.focus === index ? ' focus' : ''}`,
      'aria-label':
        tile.kind === 'item'
          ? label
          : fill(tile.state === 'owned' ? SHOP_TEXTS.pieceMine : SHOP_TEXTS.piecePrice, {
              objet: tile.name,
              prix: formatEuros(tile.unit ?? 0),
            }),
      'data-index': index,
      'data-item': tile.item,
    });
    node.innerHTML = tileImage(tile);
    if (tile.kind === 'piece') {
      // Une pièce de tenue: son prix, ou « à toi » si elle est déjà dans ta garde-robe.
      if (tile.state === 'owned')
        node.append(el('span', { class: 'pastille shop-tile__mine', text: SHOP_TEXTS.mineShort }));
      else if (tile.unit !== null)
        node.append(
          el(
            'span',
            {
              class: `pastille shop-tile__price${tile.state === 'ok' ? '' : ' shop-tile__price--no'}`,
            },
            [el('span', { class: 'coin coin--sm' }), formatEuros(tile.unit)],
          ),
        );
      if (model?.focus === index)
        node.append(el('span', { class: 'shop-nametag', text: tile.name }));
      node.addEventListener('click', () => {
        setUi({ focus: index, quantity: 1 });
      });
      return node;
    }
    if (tile.unit !== null) {
      const price = el(
        'span',
        { class: `pastille shop-tile__price${tile.state === 'ok' ? '' : ' shop-tile__price--no'}` },
        [el('span', { class: 'coin coin--sm' }), formatEuros(tile.unit)],
      );
      if (tile.need) price.classList.add('shop-tile__price--need');
      node.append(price);
    }
    if (tab === 'sell' || tile.owned > 0)
      node.append(el('span', { class: 'shop-tile__own', text: `×${String(tile.owned)}` }));
    if (tab === 'buy' && tile.stock !== null)
      node.append(el('span', { class: 'shop-tile__stock', text: String(tile.stock) }));
    if (tile.state === 'refused') node.append(icon('refus', 'ic shop-tile__no'));
    if (model?.focus === index) node.append(el('span', { class: 'shop-nametag', text: tile.name }));
    node.addEventListener('click', () => {
      setUi({ focus: index, quantity: 1 });
    });
    return node;
  }

  function render(world: ReadonlyWorld, me: PlayerIndex, force = false): void {
    if (ui === null) return;
    model = shopModel(content, world, me, ui);
    if (model === null) {
      close();
      return;
    }
    const now = performance.now();
    if (message !== null && now > message.until) message = null;
    const signature = JSON.stringify([
      ui,
      model.tiles,
      model.detail,
      model.news,
      world.players[me].money,
      world.common.chest,
      message?.text,
    ]);
    if (!force && signature === drawn) return;
    drawn = signature;
    const m = model;
    const shop = m.shop;
    const keeperName = m.keeperName;

    const bust = el('div', {
      class: `shop-bust${message === null ? '' : ` shop-bust--${message.mood}`}`,
    });
    bust.innerHTML = portraitMarkup(shop.keeper);
    const keeper = el('aside', { class: 'shop-keeper' }, [
      bust,
      el('span', { class: 'provisoire shop-keeper__tag', text: SHOP_TEXTS.provisional }),
      message?.mood === 'joy'
        ? el('div', { class: 'shop-emote', 'aria-hidden': 'true', text: '♪' })
        : null,
      message === null
        ? null
        : el('div', {
            class: `shop-say shop-say--${message.mood}`,
            role: 'status',
            text: message.text,
          }),
      el('div', { class: 'shop-keeper__counter' }, [
        el('div', { class: 'shop-keeper__plate' }, [icon(shop.icon ?? 'echoppe'), keeperName]),
      ]),
    ]);

    const tab = (id: ShopTab, label: string, icons: string[]): HTMLElement => {
      const b = el(
        'button',
        { class: 'shop-bigtab', role: 'tab', 'aria-selected': String(ui?.tab === id) },
        [...icons.map((i) => icon(i)), label],
      );
      b.addEventListener('click', () => {
        setUi({ tab: id, focus: 0, quantity: 1, chest: false });
      });
      return b;
    };
    const talkButton = (name: string): HTMLElement => {
      const label = fill(SHOP_TEXTS.talkLabel, { nom: name, touche: keyLabel('KeyP') });
      const b = el(
        'button',
        {
          class: `shop-talk${m.news ? ' shop-talk--news' : ''}`,
          'aria-label': m.news ? `${label}. ${fill(SHOP_TEXTS.talkNews, { nom: name })}` : label,
        },
        [
          icon('parole'),
          SHOP_TEXTS.talk,
          keyChip('KeyP'),
          // Pastille: une réplique pas encore entendue attend chez ce commerçant.
          m.news ? el('span', { class: 'shop-talk__news', 'aria-hidden': 'true' }) : null,
        ],
      );
      b.addEventListener('click', talk);
      return b;
    };
    const wanted = m.tiles.slice(0, m.refusedFrom);
    const refused = m.tiles.slice(m.refusedFrom);
    const shelves = el('section', { class: 'shop-shelves' }, [
      el('div', { class: 'shop-bigtabs' }, [
        el('div', { class: 'shop-bigtabs__tabs', role: 'tablist' }, [
          tab('buy', SHOP_TEXTS.buy, ['etagere']),
          tab('sell', SHOP_TEXTS.sell, ['sac', 'fleche']),
        ]),
        talkButton(keeperName),
      ]),
      wanted.length === 0 && refused.length === 0
        ? el(
            'p',
            {
              class: 'shop-empty',
              text: m.tab === 'buy' ? SHOP_TEXTS.nothingToBuy : SHOP_TEXTS.nothingToSell,
            },
            [],
          )
        : null,
      wanted.length > 0
        ? el(
            'div',
            {
              class: 'shop-grid',
              role: 'grid',
              'aria-label': fill(m.tab === 'buy' ? SHOP_TEXTS.buyGrid : SHOP_TEXTS.sellGrid, {
                nom: keeperName,
              }),
            },
            wanted.map((t, i) => tileNode(t, i, m.tab, keeperName)),
          )
        : null,
      refused.length > 0
        ? el(
            'div',
            {
              class: 'shop-sep',
              role: 'img',
              'aria-label': fill(SHOP_TEXTS.notWanted, { nom: keeperName }),
            },
            [
              miniBust(shop.keeper),
              icon('refus'),
              el('span', {
                class: 'shop-sep__text',
                text: shop.refusal ?? fill(SHOP_TEXTS.notWanted, { nom: keeperName }),
              }),
            ],
          )
        : null,
      refused.length > 0
        ? el(
            'div',
            {
              class: 'shop-grid',
              role: 'grid',
              'aria-label': fill(SHOP_TEXTS.refusedGrid, { nom: keeperName }),
            },
            refused.map((t, i) => tileNode(t, m.refusedFrom + i, m.tab, keeperName)),
          )
        : null,
      el('div', { class: 'shop-foot' }, [
        el('span', {}, [keyChip('KeyQ'), keyChip('KeyE'), SHOP_TEXTS.keysTabs]),
        // Une pièce de tenue se prend une fois: pas de quantité à régler.
        m.detail?.tile.kind === 'piece'
          ? null
          : el('span', {}, [keyChip('KeyA'), keyChip('KeyD'), SHOP_TEXTS.keysQty]),
        m.detail?.chest === 'optional'
          ? el('span', {}, [keyChip('KeyV'), SHOP_TEXTS.keysChest])
          : null,
        el('span', {}, [keyChip('Backspace'), SHOP_TEXTS.keysClose]),
      ]),
    ]);

    const side = el('aside', { class: 'shop-side', 'aria-live': 'polite' });
    const d = m.detail;
    if (d !== null) {
      const piece = d.tile.kind === 'piece';
      const thumb = el('div', { class: `shop-v3d${piece ? ' shop-v3d--tenue' : ''}` });
      thumb.innerHTML = tileImage(d.tile);
      if (!piece)
        thumb.append(
          el('span', {
            class: 'provisoire shop-v3d__tag',
            text: SHOP_TEXTS.provisional.replace('Portrait', 'Image'),
          }),
        );
      const slotName = EDITOR_TEXTS.slots[d.tile.slot ?? ''] ?? d.tile.slot ?? '';
      const pastilles = piece
        ? el('div', { class: 'shop-row' }, [
            el(
              'span',
              {
                class: 'pastille',
                role: 'img',
                'aria-label': fill(SHOP_TEXTS.slot, { slot: slotName }),
              },
              [icon('tenue'), slotName],
            ),
          ])
        : el('div', { class: 'shop-row' }, [
            d.hunger === null
              ? null
              : el(
                  'span',
                  {
                    class: 'pastille',
                    role: 'img',
                    'aria-label': fill(SHOP_TEXTS.hunger, { n: d.hunger }),
                  },
                  [icon('bol'), `+${String(d.hunger)}`],
                ),
            el(
              'span',
              {
                class: 'pastille',
                role: 'img',
                'aria-label': fill(SHOP_TEXTS.owned, { n: d.tile.owned }),
              },
              [icon('sac'), String(d.tile.owned)],
            ),
            m.tab === 'buy' && d.tile.stock !== null
              ? el(
                  'span',
                  {
                    class: 'pastille',
                    role: 'img',
                    'aria-label': fill(SHOP_TEXTS.stock, { n: d.tile.stock }),
                  },
                  [icon('etagere'), String(d.tile.stock)],
                )
              : null,
            d.tile.need
              ? el('span', { class: 'pastille pastille--full', text: SHOP_TEXTS.need })
              : null,
          ]);
      const knownRow =
        m.tab === 'sell'
          ? el(
              'div',
              {
                class: 'shop-row',
                role: 'group',
                'aria-label': `${SHOP_TEXTS.knownPrices} : ${d.known.map((k) => `${k.keeperName} ${formatEuros(k.cents)}`).join(', ') || SHOP_TEXTS.knownNone}`,
              },
              d.known.length === 0
                ? [el('span', { class: 'shop-known-none', text: SHOP_TEXTS.unknownBuyer })]
                : d.known.map((k) =>
                    el(
                      'span',
                      {
                        class: `shop-buyer${k.best ? ' shop-buyer--best' : ''}${k.here ? ' shop-buyer--here' : ''}`,
                        title: k.keeperName,
                      },
                      [
                        k.best ? icon('couronne') : null,
                        miniBust(k.keeper),
                        el('span', { class: 'coin coin--sm' }),
                        formatEuros(k.cents),
                      ],
                    ),
                  ),
            )
          : null;
      const stepBtn = (sign: -1 | 1): HTMLElement => {
        const b = el(
          'button',
          {
            'aria-label': `${sign < 0 ? SHOP_TEXTS.less : SHOP_TEXTS.more} (${keyLabel(sign < 0 ? 'KeyA' : 'KeyD')})`,
          },
          [icon(sign < 0 ? 'moins' : 'plus')],
        );
        b.addEventListener('click', () => {
          setUi({ quantity: Math.max(1, (m.detail?.quantity ?? 1) + sign) });
        });
        return b;
      };
      const stepper = el(
        'div',
        { class: 'shop-stepper', role: 'group', 'aria-label': SHOP_TEXTS.quantity },
        [
          stepBtn(-1),
          el('div', { class: 'shop-stepper__n' }, [
            String(d.quantity),
            el('small', { text: ` / ${String(d.max)}` }),
          ]),
          stepBtn(1),
        ],
      );
      const totalText = fill(m.tab === 'buy' ? SHOP_TEXTS.totalBuy : SHOP_TEXTS.totalSell, {
        montant: formatEuros(d.total),
      });
      const total = el('div', { class: 'shop-total', role: 'img', 'aria-label': totalText }, [
        icon('fleche'),
        el('span', { class: 'coin' }),
        formatEuros(d.total),
      ]);
      const chestRow =
        d.chest === 'never'
          ? null
          : el(
              'button',
              {
                class: `shop-chest${d.chestPart > 0 ? ' shop-chest--on' : ''}`,
                'aria-pressed': String(d.chestPart > 0),
              },
              [
                icon('coffre'),
                d.chest === 'always' ? SHOP_TEXTS.household : SHOP_TEXTS.withChest,
                d.chestPart > 0
                  ? el('small', {
                      text: fill(SHOP_TEXTS.chestPays, { montant: formatEuros(d.chestPart) }),
                    })
                  : null,
              ],
            );
      chestRow?.addEventListener('click', () => {
        setUi({ chest: !(ui?.chest ?? false) });
      });
      // Pièce déjà à soi: une mention, pas de bouton (il n'y a rien à acheter).
      const mine = piece && d.tile.state === 'owned';
      const action = mine
        ? el('p', { class: 'shop-mine' }, [icon('tenue'), SHOP_TEXTS.mineShort])
        : el('button', { class: `shop-btn${d.quantity === 0 ? ' shop-btn--off' : ''}` }, [
            keyChip('Enter'),
            m.tab === 'buy' ? SHOP_TEXTS.buy : SHOP_TEXTS.sell,
          ]);
      if (!mine) action.addEventListener('click', confirm);
      // Ce qui empêche l'achat ou la vente se dit en image et en mots, jamais par la seule couleur.
      const purse = world.players[me].money + d.chestPart;
      const why =
        d.tile.state === 'refused'
          ? fill(SHOP_TEXTS.notWanted, { nom: keeperName })
          : d.tile.state === 'out-of-stock'
            ? (shopRefusalText('out-of-stock') ?? '')
            : d.tile.state === 'too-expensive'
              ? `${shopRefusalText('not-enough-money') ?? ''}${fill(SHOP_TEXTS.tooExpensive, { montant: formatEuros((d.tile.unit ?? 0) - purse) })}`
              : d.tile.state === 'owned'
                ? SHOP_TEXTS.mine
                : d.quantity === 0 && m.tab === 'sell'
                  ? (shopRefusalText('shop-cap-reached') ?? '')
                  : null;
      const refused = d.tile.state === 'refused';
      side.append(
        thumb,
        el('h2', { text: d.tile.name }),
        d.tile.description === null
          ? ''
          : el('p', { class: 'shop-desc', text: d.tile.description }),
        pastilles,
        knownRow ?? '',
        refused || piece ? '' : stepper,
        refused || mine ? '' : total,
        chestRow ?? '',
        action,
      );
      if (why !== null)
        side.append(
          el('p', { class: `shop-why${d.tile.state === 'owned' ? ' shop-why--mine' : ''}` }, [
            icon(d.tile.state === 'owned' ? 'tenue' : 'refus'),
            why,
          ]),
        );
    }

    const panel = el(
      'main',
      {
        class: 'shop',
        role: 'dialog',
        'aria-label': fill(SHOP_TEXTS.label, { boutique: shop.name, nom: keeperName }),
      },
      [keeper, shelves, side],
    );
    const previous = layer.querySelector('.shop');
    if (previous === null) layer.append(panel);
    else {
      panel.classList.add('shop--still');
      previous.replaceWith(panel);
    }
    const coins = layer.querySelector('.shop-coins');
    if (coins !== null) layer.append(coins);
  }

  function miniBust(id: string): HTMLElement {
    const mini = el('span', { class: 'shop-mini' });
    mini.innerHTML = portraitMarkup(id);
    return mini;
  }

  function flyCoins(count: number, toPurse: boolean): void {
    if (reduced()) return;
    layer.querySelector('.shop-coins')?.remove();
    const box = el('div', {
      class: `shop-coins shop-coins--${toPurse ? 'in' : 'out'}`,
      'aria-hidden': 'true',
    });
    for (let i = 0; i < Math.min(5, Math.max(1, count)); i += 1) {
      const c = el('span', { class: 'coin' });
      c.style.animationDelay = `${String(i * 70)}ms`;
      box.append(c);
    }
    layer.append(box);
    setTimeout(() => {
      box.remove();
    }, 900);
  }

  function close(): void {
    ui = null;
    model = null;
    message = null;
    drawn = '';
    layer.hidden = true;
    layer.querySelector('.shop')?.remove();
  }

  return {
    isOpen() {
      return ui !== null;
    },
    open(shop, now) {
      ui = { shop, tab: 'buy', focus: 0, quantity: 1, chest: false };
      openedAt = now;
      drawn = '';
      message = null;
      layer.hidden = false;
      layer.querySelector('.shop')?.remove();
    },
    close,
    onEvent(event, me, now) {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- la boutique n'écoute que ses événements et les refus
      switch (event.type) {
        case 'shop_opened':
          if (event.player === me) this.open(event.shop, now);
          return;
        case 'shop_bought':
          if (event.player === me && ui?.shop === event.shop) {
            say(keeperSays('bought', SHOP_TEXTS.bought), 'yes', performance.now());
            flyCoins(event.count, false);
          }
          return;
        case 'shop_piece_bought':
          if (event.player === me && ui?.shop === event.shop) {
            say(keeperSays('bought', SHOP_TEXTS.bought), 'yes', performance.now());
            flyCoins(1, false);
          }
          return;
        case 'shop_sold':
          if (event.player === me && ui?.shop === event.shop) {
            say(keeperSays('sold', SHOP_TEXTS.sold), event.need ? 'joy' : 'yes', performance.now());
            flyCoins(event.count, true);
            setUi({ quantity: 1 });
          }
          return;
        case 'refused':
          if (event.player === me && ui !== null && event.target === ui.shop)
            say(keeperRefuses(event.reason), 'no', performance.now());
          return;
        // « Parler » a ouvert la conversation: la boutique s'efface derrière le dialogue.
        case 'talk_started':
          if (event.player === me && ui !== null) close();
          return;
        default:
          return;
      }
    },
    frame(world, me) {
      last = { world, me };
      if (ui === null) return;
      makeThumbs(world, me);
      render(world, me);
    },
    key(code, now) {
      if (ui === null) return false;
      if (now - openedAt < openGuardMs) return true;
      const m = model;
      const count = m?.tiles.length ?? 0;
      const moveFocus = (delta: number): void => {
        if (count === 0) return;
        setUi({ focus: Math.min(count - 1, Math.max(0, (m?.focus ?? 0) + delta)), quantity: 1 });
      };
      switch (code) {
        case 'KeyQ':
          setUi({ tab: 'buy', focus: 0, quantity: 1, chest: false });
          return true;
        case 'KeyE':
          setUi({ tab: 'sell', focus: 0, quantity: 1, chest: false });
          return true;
        case 'KeyA':
          setUi({ quantity: Math.max(1, (m?.detail?.quantity ?? 1) - 1) });
          return true;
        case 'KeyD':
          setUi({ quantity: Math.min(m?.detail?.max ?? 1, (m?.detail?.quantity ?? 0) + 1) });
          return true;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
          setUi({ quantity: Number(code.slice(5)) });
          return true;
        case 'ArrowLeft':
          moveFocus(-1);
          return true;
        case 'ArrowRight':
          moveFocus(1);
          return true;
        case 'ArrowUp':
        case 'KeyW':
          moveFocus(-COLUMNS);
          return true;
        case 'ArrowDown':
        case 'KeyS':
          moveFocus(COLUMNS);
          return true;
        case 'KeyV':
          if (m?.detail?.chest === 'optional') setUi({ chest: !ui.chest });
          return true;
        case 'Enter':
        case 'Space':
          confirm();
          return true;
        case 'KeyP':
          talk();
          return true;
        case 'Backspace':
          close();
          return true;
        default:
          // Toute autre touche reste à la boutique: la boucle n'envoie ni pas ni geste.
          return true;
      }
    },
    dispose() {
      pieceThumbs.clear();
      layer.remove();
    },
  };
}
