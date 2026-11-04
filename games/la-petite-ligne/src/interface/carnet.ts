/**
 * Carnet (maquette `carnet.html`): onglets Quêtes, Voisins (0.13), Courrier, Sac, Poissons (0.12), Souvenirs et Besoins.
 * A et E changent d'onglet (la caméra ne tourne pas pendant le carnet), Tab ou
 * Retour arrière le ferment.
 */
import type { CharacterId, ReadonlyWorld } from '../etat/types';
import type { KeyInfo, PanelTab, UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { characterOf } from './contexte';
import { button, el, focusElement, icon, keycap, keysLine, portrait, setAttr, setText, secretStamp, token } from './dom';
import { defaultBagSlot, defaultLetter } from './focus';
import { itemDetail, bagEmpty, bagFull, grocerPrice } from './modele-panneaux';
import { letterModels, slotModel } from './modele';
import { type QuestCardModel, type QuestNeedModel, type QuestPlaceModel, questBoard } from './modele-quetes';
import type { SecretView } from './modele-secrets';
import { villagerPortraitHtml } from './portrait';
import { type MomentHintModel, momentHintModel } from './modele-moments';
import { GENERIC_VIGNETTE, type MemoriesPageModel, type MemoryEntryModel, memoriesPageModel } from './modele-souvenirs';
import { type NeedsPageModel, needsPage } from './modele-maison';
import { CURRENCY } from '../donnees/monnaie';
import { capitalize, itemTitle } from './format';
import { infoIcon, rarityClass, rarityIcon } from './icones';
import { type FishBoardModel, type FishCardModel, fishBoard, itemFacts } from './modele-vitrine';
import {
  type PastilleSpec,
  type VitrineItem,
  Vitrine,
  detailActions,
  detailFigure,
  detailHead,
  fishSilhouette,
  iconRow,
  layeredIcon,
  need,
  pastille,
  pastilles,
  riverMap,
} from './vitrine';
import { Panel } from './panneau';
import { NeighboursPage } from './voisins';
import { needsMuted, setNeedsMuted } from './preferences';
import { SOUND_ATTR } from './sons';

type NotebookTab = 'quests' | 'neighbours' | 'mail' | 'bag' | 'fish' | 'memories' | 'needs';
// 0.13: « Voisins » juste après les quêtes (les habitants et leurs histoires vont ensemble).
const TABS: readonly NotebookTab[] = ['quests', 'neighbours', 'mail', 'bag', 'fish', 'memories', 'needs'];

function isNotebookTab(tab: string | undefined): tab is NotebookTab {
  return TABS.some((t) => t === tab);
}

/** Dernier onglet ouvert, gardé d'une ouverture à l'autre. */
let lastTab: NotebookTab = 'quests';

/** Onglet du prochain carnet ouvert (page de démonstration, captures). */
export function rememberNotebookTab(tab: NotebookTab): void {
  lastTab = tab;
}

/**
 * Souvenirs déjà vus par ce joueur pendant la séance (`stamp` des entrées): une entrée née ou
 * revue depuis porte un filet de laiton à l'ouverture suivante de l'onglet, jusqu'à ce qu'on
 * l'ait vue. Ceux d'avant la séance sont tenus pour vus (`startMemorySession`).
 */
const seenMemories = new Map<CharacterId, Set<string>>();

function stampsOf(world: ReadonlyWorld): string[] {
  return [
    ...world.memories.moments.map((m) => `moment:${m.id}:${String(m.count)}`),
    ...world.memories.secrets.map((m) => `secret:${m.quest}`),
  ];
}

/** Début de séance (montage de l'interface): les souvenirs déjà là ne sont pas nouveaux. */
export function startMemorySession(world: ReadonlyWorld, me: CharacterId): void {
  seenMemories.set(me, new Set(stampsOf(world)));
}

export class NotebookPanel extends Panel {
  private tab: NotebookTab;
  private readonly tabButtons: Record<NotebookTab, HTMLButtonElement>;
  private readonly badge: HTMLSpanElement;
  private checked: number | null = null;
  private moving: number | null = null;
  private letter: string | null = null;
  private dragFrom: number | null = null;
  /** Souvenirs nouveaux pendant cette visite de l'onglet (filet de laiton), ou `null` hors de l'onglet. */
  private freshMemories: Set<string> | null = null;
  /** Patch 0.12.2: les poissons en vignettes, avec le détail de la sélection. */
  private readonly fishPage: Vitrine;
  /**
   * Patch 0.12.2: les quêtes en cartes, deux colonnes, le détail de la carte choisie. Les quêtes en
   * cours d'un côté, les finies de l'autre (deux pastilles à presser): les finies s'accumulent, et
   * A et E ne tournent des pages que s'il y en a, avant de passer à l'onglet voisin.
   */
  private readonly questPages: Record<'open' | 'done', Vitrine>;
  private questView: 'open' | 'done' = 'open';
  /** 0.13: l'onglet Voisins (portraits, fiche, frise, carte du bourg). */
  private readonly neighboursPage: NeighboursPage;
  /** La case du sac était déjà choisie au moment du clic (un second clic fait l'action principale). */
  private readonly pressed = { selected: false };

  constructor(host: UiHost, tab: PanelTab | undefined) {
    const { ctx } = host;
    const n = ctx.texts.extra.notebook;
    const tabKey = ctx.key('Tab');
    const back = ctx.key('Backspace');
    super(
      host,
      {
        icon: 'ui-notebook',
        title: ctx.t(n.title),
        closeKeyLabel: tabKey,
        closeAria: ctx.t(n.closeLabel, { tab: tabKey, back }),
      },
      'Tab',
    );
    this.tab = isNotebookTab(tab) ? tab : lastTab;
    this.neighboursPage = new NeighboursPage(host);
    this.fishPage = new Vitrine(host, { perPage: UI_SETTINGS.vitrine.fishPerPage, label: ctx.t(ctx.texts.extra.fish.pageLabel), variant: 'lpl-vitrine--fish' });
    const questOptions = { perPage: UI_SETTINGS.vitrine.questsPerPage, label: ctx.t(ctx.texts.extra.vitrine.questsLabel), variant: 'lpl-vitrine--quests' };
    this.questPages = { open: new Vitrine(host, questOptions), done: new Vitrine(host, questOptions) };
    const g = ctx.texts.game.ui.notebookTabs;
    this.badge = el('span', { class: 'lpl-tab__badge', hidden: true });
    const make = (id: NotebookTab, label: string, iconId: string, extra: HTMLElement | null): HTMLButtonElement =>
      // 0.13, sept onglets: le nom ne s'écrit que sur l'onglet ouvert (`interface.css`); les autres gardent l'icône, la bulle et le nom accessible.
      button([icon(iconId), el('span', { class: 'lpl-tab__label', text: label }), extra], () => {
        this.select(id, true);
      }, { class: 'lpl-tab', attrs: { role: 'tab', 'aria-selected': 'false', tabindex: '-1', 'data-tab': id, title: label, [SOUND_ATTR]: 'none' } });
    this.tabButtons = {
      quests: make('quests', ctx.t(g.quests), 'ui-flag', null),
      neighbours: make('neighbours', ctx.t(ctx.texts.extra.neighbours.tab), 'ui-neighbours', null),
      mail: make('mail', ctx.t(g.mail), 'ui-letter', this.badge),
      bag: make('bag', ctx.t(g.bag), 'grain-sack', null),
      // Pêche 0.12: le carnet des poissons, entre « Sac » et « Souvenirs » (section 7.4).
      fish: make('fish', ctx.t(ctx.texts.extra.fish.tab), 'fish', null),
      memories: make('memories', ctx.t(g.memories), 'ui-heart', null),
      // Tour 10: les besoins en chiffres (réponse du client: icônes au HUD, chiffres au carnet).
      needs: make('needs', ctx.t(ctx.texts.extra.needs.tab), 'need-belly-full', null),
    };
    const tabs = el('div', { class: 'lpl-tabs', role: 'tablist', 'aria-label': n.tabsLabel }, [
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyQ') }),
      this.tabButtons.quests,
      this.tabButtons.neighbours,
      this.tabButtons.mail,
      this.tabButtons.bag,
      this.tabButtons.fish,
      this.tabButtons.memories,
      this.tabButtons.needs,
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyE') }),
    ]);
    this.header.insertBefore(tabs, this.closeButton);
    // Cinq onglets (tour 10): le bouton de fermeture se resserre pour tenir sur la même rangée.
    this.root.classList.add('lpl-notebook');
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      keysLine([
        { keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: n.keysPages },
        { keys: [...a], text: '' },
      ]),
      null,
    ]);
    // Pied: « ↑ ↓ ← → ou Z Q S D choisir », comme la maquette.
    const keys = this.footer.querySelector('.lpl-keys');
    const arrows = keys?.lastElementChild ?? null;
    if (arrows !== null) {
      arrows.append(` ${ctx.texts.extra.keys.or} `);
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) arrows.append(keycap(ctx.key(code)));
      arrows.append(` ${n.keysChoose}`);
      keys?.append(el('span', {}, [keycap(back), ` ${n.keysClose}`]));
    }
    this.footer.append(el('span', { text: ctx.t(n.gameGoesOn) }));
    // R01: le jeu n'a pas de menu de pause à lui (Échap ouvre celui de Duo); le carnet le remplace.
    this.footer.append(
      button(ctx.t(n.unstick), () => {
        this.host.send({ type: 'unstick' });
        this.close();
      }, { class: 'lpl-button', attrs: { title: ctx.t(n.unstickHelp), 'data-key': 'unstick' } }),
    );
    this.markTabs();
  }

  private markTabs(): void {
    for (const id of TABS) {
      const b = this.tabButtons[id];
      setAttr(b, 'aria-selected', String(id === this.tab));
      b.tabIndex = id === this.tab ? 0 : -1;
    }
  }

  private select(tab: NotebookTab, focus: boolean): void {
    if (tab !== this.tab) {
      this.host.sound('ui-tab');
      this.tab = tab;
      lastTab = tab;
      this.moving = null;
      this.freshMemories = null;
      this.markTabs();
      this.host.invalidate();
    }
    if (focus) {
      // Le contenu de l'onglet est reconstruit au prochain rafraîchissement.
      window.requestAnimationFrame(() => {
        focusElement(this.defaultFocus());
      });
    }
  }

  override key(code: string, info: KeyInfo): boolean {
    if (code === 'KeyQ' || code === 'KeyE') {
      // Poissons et quêtes: les pages d'abord (au-delà de 28 poissons, de 8 quêtes), puis l'onglet voisin.
      if (this.tab === 'fish' && this.fishPage.turn(code === 'KeyQ' ? -1 : 1)) return true;
      if (this.tab === 'quests' && this.questPages[this.questView].turn(code === 'KeyQ' ? -1 : 1)) return true;
      if (this.tab === 'neighbours' && this.neighboursPage.turn(code === 'KeyQ' ? -1 : 1)) return true;
      const index = TABS.indexOf(this.tab);
      const next = TABS[(index + (code === 'KeyQ' ? -1 : 1) + TABS.length) % TABS.length] ?? 'quests';
      this.select(next, true);
      return true;
    }
    if (this.tab !== 'bag' || !info.inside) return false;
    const active = document.activeElement;
    const slot = active instanceof HTMLElement ? active.dataset.slot : undefined;
    if (slot === undefined) return false;
    const index = Number(slot);
    if (code === 'Space') {
      if (!info.repeat) this.toggleMove(index);
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      if (!info.repeat) this.primary(index);
      return true;
    }
    return false;
  }

  /** Espace sur une case: la prendre, puis la poser sur une autre (déplacer). */
  private toggleMove(index: number): void {
    if (this.moving === null) {
      this.moving = index;
      this.checked = index;
    } else {
      if (this.moving !== index) this.host.send({ type: 'swap_slots', from: this.moving, to: index });
      this.moving = null;
      this.checked = index;
    }
    this.host.invalidate();
  }

  /** Entrée sur une case: l'action principale de l'objet (manger, lire, prendre en main). */
  private primary(index: number): void {
    this.checked = index;
    const world = this.lastWorld;
    const me = world === null ? null : characterOf(world, this.host.ctx.me);
    const stack = me?.bag[index] ?? null;
    if (stack === null) return;
    const detail = itemDetail(this.host.ctx, stack);
    const action = detail.actions[0];
    if (action !== undefined) this.runAction(action, index, stack.item);
    this.host.invalidate();
  }

  private runAction(action: 'eat' | 'hold' | 'read', index: number, item: string): void {
    const world = this.lastWorld;
    const me = world === null ? null : characterOf(world, this.host.ctx.me);
    if (me === null) return;
    if (action === 'eat') this.host.send({ type: 'eat', item });
    else if (action === 'read') this.host.read(item);
    else {
      // Prendre en main: l'objet va à la case choisie de la barre d'outils si besoin.
      if (index >= UI_SETTINGS.toolbarSlots) {
        this.host.send({ type: 'swap_slots', from: index, to: me.selected });
        this.host.send({ type: 'select_slot', slot: me.selected });
      } else {
        this.host.send({ type: 'select_slot', slot: index });
      }
      this.close();
    }
  }

  private lastWorld: ReadonlyWorld | null = null;

  update(world: ReadonlyWorld): void {
    this.lastWorld = world;
    const { ctx } = this.host;
    const letters = letterModels(world, ctx);
    const unread = letters.filter((l) => l.unread).length;
    this.badge.toggleAttribute('hidden', unread === 0);
    setText(this.badge, String(unread));
    setAttr(this.badge, 'aria-label', ctx.t(unread > 1 ? ctx.texts.extra.notebook.unreadMany : ctx.texts.extra.notebook.unread, { count: unread }));
    if (this.tab === 'quests') this.renderQuests(world);
    else if (this.tab === 'neighbours') this.renderNeighbours(world);
    else if (this.tab === 'mail') this.renderMail(letters);
    else if (this.tab === 'bag') this.renderBag(world);
    else if (this.tab === 'needs') this.renderNeeds(world);
    else if (this.tab === 'fish') this.renderFish(world);
    else this.renderMemories(world);
  }

  /** Voisins (0.13, lot H3): la vitrine des portraits et la fiche, ou la carte du bourg (`voisins.ts`). */
  private renderNeighbours(world: ReadonlyWorld): void {
    const { sig, build } = this.neighboursPage.render(world);
    this.renderBody(sig, build);
    this.neighboursPage.afterRender();
  }

  /**
   * Besoins (tour 10, section 3): la forme du jour, les trois besoins avec leurs chiffres, et les
   * aides personnelles (« Besoins en sourdine »), invisibles pour l'autre.
   */
  private renderNeeds(world: ReadonlyWorld): void {
    const page = needsPage(world, this.host.ctx, needsMuted());
    if (page === null) return;
    const sig = JSON.stringify(['needs', page]);
    this.renderBody(sig, () => this.needsNodes(page));
  }

  private needsNodes(page: NeedsPageModel): HTMLElement[] {
    const { ctx } = this.host;
    const n = ctx.texts.extra.needs;
    const list = el('ul', { class: 'lpl-needs-page__list', 'data-nav': 'list' });
    for (const row of page.rows) {
      list.append(
        el('li', { class: 'lpl-needs-page__row', tabindex: '0', 'data-nav-item': true, 'data-key': `need:${row.need}`, 'data-autofocus': row.need === 'belly' }, [
          el('span', { class: 'lpl-need lpl-need--large', 'data-tone': row.icon.tone, 'aria-hidden': 'true' }, [icon(row.icon.icon)]),
          el('span', { class: 'lpl-needs-page__name' }, [el('strong', { text: row.title }), el('span', { text: row.icon.state })]),
          el('span', { class: 'lpl-needs-page__value' }, [
            el('span', { class: 'lpl-order__bar' }, [el('span', { style: `--lpl-value: ${Math.round(row.ratio * 100)}%` })]),
            el('strong', { text: row.value }),
          ]),
          el('small', { class: 'lpl-needs-page__help', text: row.help }),
        ]),
      );
    }
    const mute = el('input', { type: 'checkbox', class: 'lpl-check__input', 'data-nav-item': true, 'data-key': 'mute-needs' });
    mute.checked = page.muted;
    mute.addEventListener('change', () => {
      setNeedsMuted(mute.checked);
      this.host.invalidate();
    });
    return [
      el('div', { class: 'lpl-needs-page', role: 'region', 'aria-label': ctx.t(n.pageLabel) }, [
        el('p', { class: 'lpl-needs-page__form' }, [el('span', { class: 'lpl-overline', text: ctx.t(n.form) }), el('strong', { text: page.form }), el('span', { text: page.formText })]),
        list,
        el('p', { class: 'lpl-field__help' }, [page.apart, page.napped ? ` · ${ctx.t(n.napped)}` : '']),
        el('section', { class: 'lpl-needs-page__aids' }, [
          el('h3', { class: 'lpl-section-title', text: ctx.t(n.aids) }),
          el('label', { class: 'lpl-check' }, [mute, el('span', {}, [el('strong', { text: ctx.t(n.mute) }), el('small', { text: ctx.t(n.muteHelp) })])]),
          el('p', { class: 'lpl-field__help', text: ctx.t(n.aidsHelp, { partner: page.partner }) }),
        ]),
      ]),
    ];
  }

  /**
   * Poissons (pêche 0.12; patch 0.12.2): une grille de vignettes au liseré de rareté, une silhouette
   * grise pour ceux pas encore pris, et le détail de la sélection en icônes (saisons, moments, coins
   * sur une petite carte de la rivière, prix, record, prises).
   */
  private renderFish(world: ReadonlyWorld): void {
    const board = fishBoard(world, this.host.ctx);
    const sig = JSON.stringify(['fish', board, this.fishPage.page]);
    this.renderBody(sig, () => this.fishNodes(board));
  }

  private fishNodes(board: FishBoardModel): HTMLElement[] {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const t = ctx.texts.extra.fish;
    const strip = el('div', { class: 'lpl-vitrine__strip' }, [
      pastille({ icon: infoIcon('caught'), text: `${String(board.caught)}/${String(board.total)}`, tone: board.caught === board.total ? 'ok' : 'count', label: ctx.t(v.countLabel, { caught: board.caught, total: board.total }) }),
      board.here === null ? null : pastille({ icon: 'ui-pin', text: board.here, tone: 'info', label: ctx.t(v.here, { zone: board.here }) }),
    ]);
    const items = board.cards.map((c): VitrineItem => {
      // Le poisson pris sur le fond teinté de sa rareté (dessin de l'artiste); sinon sa silhouette grise.
      const figure = c.caught ? layeredIcon([rarityIcon(c.rarity), c.icon], 'lpl-tile__icon') : fishSilhouette(c.shadowLength);
      const scales = el('span', { class: 'lpl-fish__scales', 'aria-hidden': 'true', text: '◆'.repeat(c.scales) });
      return {
        key: `fish:${c.id}`,
        tile: {
          icon: figure,
          name: c.name,
          label: `${c.name}, ${ctx.t(t.rarities[c.rarity])}${c.caught ? `, ${ctx.t(v.catchesLabel, { count: c.count })}` : ''}`,
          badge: c.caught ? { icon: null, text: `×${String(c.count)}`, tone: 'count' } : null,
          state: c.caught ? null : 'locked',
          below: scales,
          className: `lpl-tile--fish ${rarityClass(c.rarity)}`,
          attrs: { 'data-rarity': c.rarity, 'data-caught': c.caught ? 'true' : 'false' },
        },
        detail: () => this.fishDetail(c),
      };
    });
    const first = board.cards[0]?.id ?? null;
    return [strip, this.fishPage.build(items, first === null ? null : `fish:${first}`)];
  }

  private fishDetail(c: FishCardModel): (Node | null)[] {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const t = ctx.texts.extra.fish;
    const head = detailHead(c.caught ? layeredIcon([rarityIcon(c.rarity), c.icon], 'lpl-detail__icon') : fishSilhouette(c.shadowLength), c.name, c.line, `lpl-detail__figure--fish ${rarityClass(c.rarity)}`);
    const rarity = el('span', { class: 'lpl-fish__rarity', 'data-rarity': c.rarity, role: 'img', 'aria-label': `${ctx.t(t.rarities[c.rarity])}, ${ctx.t(t.scalesLabel, { count: c.scales })}` }, [el('span', { 'aria-hidden': 'true', text: '◆'.repeat(c.scales) })]);
    if (!c.caught) return [...head, rarity];
    const seasonNames = c.seasons.map((s) => ({ ...s, name: capitalize(t.seasonNames[s.id]) }));
    const momentNames = c.moments.map((m) => ({ ...m, name: capitalize(v.momentNames[m.id]) }));
    const onList = (list: readonly { on: boolean; name: string }[]): string =>
      list
        .filter((x) => x.on)
        .map((x) => x.name)
        .join(', ');
    const zonesOn = c.zones.filter((z) => z.on).map((z) => z.name);
    const record = c.record;
    const recordPastille = record === null ? null : pastille({ icon: infoIcon('record'), text: `${String(record.cm)} cm`, tone: 'info', label: ctx.t(v.recordLabel, { cm: record.cm, name: record.name }) });
    recordPastille?.append(token(record?.by ?? 'self', this.host.symbol(record?.by ?? 'self'), 'small'));
    return [
      ...head,
      rarity,
      el('div', { class: 'lpl-detail__row' }, [
        iconRow(seasonNames.map((s) => ({ icon: infoIcon(s.id), on: s.on, label: s.name })), ctx.t(v.seasonsLabel, { list: onList(seasonNames) })),
        iconRow(momentNames.map((m) => ({ icon: infoIcon(m.id), on: m.on, label: m.name })), ctx.t(v.momentsLabel, { list: onList(momentNames) })),
      ]),
      riverMap(c.zones, ctx.t(v.zonesLabel, { list: zonesOn.join(', ') })),
      el('div', { class: 'lpl-detail__pastilles' }, [
        pastille(c.price === null ? { icon: 'ui-heart', tone: 'ok', label: ctx.t(t.released) } : { icon: CURRENCY.icon, text: String(c.price), tone: 'price', label: ctx.t(t.price, { price: ctx.t(ctx.texts.game.ui.hud.purse, { amount: c.price }) }) }),
        recordPastille,
        pastille({ icon: infoIcon('caught'), text: `×${String(c.count)}`, tone: 'count', label: ctx.t(v.catchesLabel, { count: c.count }) }),
      ]),
    ];
  }

  /**
   * Souvenirs (tour 7): une colonne du plus récent au plus ancien, un intercalaire par saison,
   * la rumeur du bourg en bas. Rien de ce qui manque ne se voit (pas de compteur, pas de case vide).
   */
  private renderMemories(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const page = memoriesPageModel(world, ctx);
    const seen = seenMemories.get(ctx.me) ?? new Set<string>();
    seenMemories.set(ctx.me, seen);
    const fresh = this.freshMemories ?? new Set<string>();
    this.freshMemories = fresh;
    for (const season of page.seasons) {
      for (const entry of season.entries) {
        if (!seen.has(entry.stamp)) fresh.add(entry.stamp);
        seen.add(entry.stamp);
      }
    }
    const sig = JSON.stringify(['memories', page, [...fresh]]);
    this.renderBody(sig, () => this.memoriesNodes(page, fresh));
  }

  private memoriesNodes(page: MemoriesPageModel, fresh: ReadonlySet<string>): HTMLElement[] {
    const { ctx } = this.host;
    const t = ctx.texts.game.souvenirs;
    const nodes: HTMLElement[] = [];
    if (page.empty !== null) nodes.push(el('p', { class: 'lpl-memories__empty', text: page.empty }));
    const first = page.seasons[0]?.entries[0]?.key ?? null;
    for (const season of page.seasons) {
      const list = el('ul', { class: 'lpl-memories__list', 'data-nav': 'list' });
      for (const entry of season.entries) list.append(this.memoryItem(entry, fresh.has(entry.stamp), entry.key === first));
      nodes.push(el('section', { class: 'lpl-memories__season' }, [el('h3', { class: 'lpl-section-title lpl-memories__divider', text: season.title }), list]));
    }
    if (page.rumor !== null) {
      nodes.push(
        el('p', { class: 'lpl-rumor', tabindex: '0', 'data-nav-item': true, 'data-key': 'rumor' }, [
          el('span', { class: 'lpl-rumor__lead', text: page.rumor.lead }),
          el('em', { class: 'lpl-rumor__text', text: page.rumor.text }),
        ]),
      );
    }
    return [el('div', { class: 'lpl-memories', role: 'region', 'aria-label': ctx.t(t.listLabel) }, nodes)];
  }

  private memoryItem(entry: MemoryEntryModel, fresh: boolean, autofocus: boolean): HTMLLIElement {
    const { ctx } = this.host;
    // Une vignette pas encore dessinée dans le sprite: la page générique, jamais une case vide.
    const vignette = document.getElementById(entry.vignette) === null ? GENERIC_VIGNETTE : entry.vignette;
    return el(
      'li',
      {
        class: 'lpl-memory',
        tabindex: '0',
        'data-nav-item': true,
        'data-key': entry.key,
        'data-fresh': fresh,
        'data-autofocus': autofocus,
      },
      [
        el('span', { class: 'lpl-memory__vignette', role: 'img', 'aria-label': entry.alt }, [icon(vignette, 'lpl-memory__icon')]),
        el('span', { class: 'lpl-memory__title', text: entry.title }),
        // « Nouveau souvenir » pour le lecteur d'écran; à l'œil, le filet de laiton suffit.
        el('span', { class: 'lpl-memory__date' }, [fresh ? el('span', { class: 'lpl-sr-only', text: `${ctx.t(ctx.texts.game.souvenirs.fresh)}. ` }) : null, entry.date]),
        entry.self === null ? null : el('span', { class: 'lpl-memory__self', text: entry.self }),
        entry.returns === null ? null : el('span', { class: 'lpl-memory__returns', text: entry.returns }),
      ],
    );
  }

  /**
   * Quêtes (patch 0.12.2): une carte par quête (l'habitant ou le thème, le titre, l'étape en une
   * ligne, les conditions en compteurs, le lieu et la récompense en pastilles), deux colonnes en
   * pages, et le texte complet de l'étape au détail de la carte choisie, avec la fiche du secret.
   */
  private renderQuests(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const board = questBoard(world, ctx);
    const hint = momentHintModel(world, ctx);
    // Rien en cours: les finies d'emblée (et inversement).
    if (this.questView === 'open' && board.open === 0 && board.done > 0) this.questView = 'done';
    if (this.questView === 'done' && board.done === 0) this.questView = 'open';
    const view = this.questView;
    const vitrine = this.questPages[view];
    const sig = JSON.stringify(['quests', board, hint, view, vitrine.page]);
    this.renderBody(sig, () => {
      if (board.cards.length === 0 && hint === null) return [el('div', { class: 'lpl-empty', text: ctx.t(ctx.texts.extra.notebook.noQuests) })];
      const v = ctx.texts.extra.vitrine;
      const filter = (id: 'open' | 'done', iconId: string, count: number, label: string): HTMLButtonElement =>
        button([icon(iconId, 'lpl-icon lpl-pastille__icon'), el('span', { class: 'lpl-pastille__text', text: String(count) })], () => {
          if (this.questView === id) return;
          this.questView = id;
          this.host.sound('ui-tab');
          this.host.invalidate();
        }, {
          class: `lpl-pastille lpl-pastille--${id === 'open' ? 'count' : 'ok'} lpl-quest-filter`,
          attrs: { 'data-nav-item': true, 'data-key': `filter:${id}`, 'aria-pressed': String(view === id), 'aria-label': label, title: label, 'aria-disabled': count === 0 ? 'true' : null, [SOUND_ATTR]: 'none' },
        });
      const strip = el('div', { class: 'lpl-vitrine__strip', role: 'group', 'aria-label': ctx.t(v.questsLabel) }, [
        filter('open', 'ui-flag', board.open, ctx.t(v.questsOpen, { count: board.open })),
        filter('done', 'ui-check', board.done, ctx.t(v.questsDone, { count: board.done })),
      ]);
      const shown = board.cards.filter((c) => c.done === (view === 'done'));
      // La confidence du jour, en tête des quêtes en cours: une carte, son texte au détail; choisie d'emblée (elle ne vaut qu'aujourd'hui).
      const hintItem = hint !== null && view === 'open' ? this.hintItem(hint) : null;
      const focus = hintItem !== null ? 'hint:today' : shown.some((c) => c.id === board.focus) ? `quest:${board.focus ?? ''}` : shown[0] === undefined ? null : `quest:${shown[0].id}`;
      const questItems = shown.map((c): VitrineItem => ({
        key: `quest:${c.id}`,
        tile: {
          icon: this.questCard(c),
          name: c.title,
          label: this.questLabel(c),
          corner: c.withdrawn ? 'ui-cross' : c.done ? 'ui-check' : c.secret !== null ? 'ui-whisper' : null,
          state: c.done ? 'done' : null,
          className: 'lpl-tile--quest',
          attrs: { 'data-group': c.group, 'data-current': c.current ? 'true' : null, 'data-withdrawn': c.withdrawn ? 'true' : null },
        },
        detail: () => this.questDetail(c),
      }));
      const items = hintItem === null ? questItems : [hintItem, ...questItems];
      return [strip, vitrine.build(items, focus)];
    });
  }

  /** La confidence du matin en carte de quête: « Aujourd'hui », le début du texte, le tampon « Rien que pour toi ». */
  private hintItem(hint: MomentHintModel): VitrineItem {
    const { ctx } = this.host;
    const title = ctx.t(ctx.texts.game.ui.momentHint);
    const card = el('span', { class: 'lpl-quest-card' }, [
      el('span', { class: 'lpl-quest-card__face lpl-quest-card__face--small', 'aria-hidden': 'true' }, [icon('ui-whisper', 'lpl-icon lpl-quest-card__icon')]),
      el('span', { class: 'lpl-quest-card__title', text: title }),
      el('span', { class: 'lpl-quest-card__step', text: hint.text }),
      el('span', { class: 'lpl-quest-card__facts' }, [secretStamp(hint.chip)]),
    ]);
    return {
      key: 'hint:today',
      tile: { icon: card, name: title, label: `${title}, ${hint.chip}, ${hint.text}`, className: 'lpl-tile--quest', attrs: { 'data-group': 'hint' } },
      detail: () => [this.hintCard(hint)],
    };
  }

  /** Nom accessible d'une carte: titre, étape, conditions, état. */
  private questLabel(c: QuestCardModel): string {
    const { ctx } = this.host;
    const parts = [c.title, c.step, ...c.needs.map((n) => n.label)];
    if (c.withdrawn) parts.push(ctx.t(ctx.texts.extra.notebook.annonceExpired));
    else if (c.done) parts.push(ctx.t(ctx.texts.game.ui.questDone));
    if (c.current) parts.push(ctx.t(ctx.texts.extra.vitrine.questCurrent));
    if (c.secret !== null) parts.push(ctx.t(ctx.texts.extra.vitrine.questSecret));
    return parts.filter((p) => p !== '').join(', ');
  }

  /** Visage de la quête: le portrait de l'habitant, sinon l'icône de son métier ou du thème. */
  private questFace(c: QuestCardModel, size: 'small' | 'large'): HTMLElement {
    const face = c.giver === null ? null : villagerPortraitHtml(c.giver, 'good');
    const inner = face === null ? icon(c.icon, 'lpl-icon lpl-quest-card__icon') : portrait(face, size === 'small' ? 'small' : '');
    return el('span', { class: `lpl-quest-card__face lpl-quest-card__face--${size}`, 'aria-hidden': 'true' }, [inner]);
  }

  private questNeed(n: QuestNeedModel): HTMLElement {
    if (n.kind === 'count') return need({ icon: n.icon, have: n.have, need: n.need, label: n.label });
    const face = n.villager === null ? null : villagerPortraitHtml(n.villager, 'good');
    const figure = face === null ? icon(n.icon, 'lpl-icon lpl-quest-check__icon') : portrait(face, 'small');
    return el('span', { class: 'lpl-quest-check', 'data-done': n.done ? 'true' : 'false', role: 'img', 'aria-label': n.label, title: n.label }, [
      figure,
      n.done ? el('span', { class: 'lpl-quest-check__mark', 'aria-hidden': 'true' }, [icon('ui-check')]) : null,
    ]);
  }

  private questPlace(p: QuestPlaceModel): HTMLElement {
    const face = p.villager === null ? null : villagerPortraitHtml(p.villager, 'good');
    const figure = face === null ? icon(p.icon, 'lpl-icon lpl-quest-place__icon') : portrait(face, 'small');
    return el('span', { class: 'lpl-quest-place', role: 'img', 'aria-label': p.label, title: p.label }, [icon('ui-pin', 'lpl-icon lpl-quest-place__pin'), figure]);
  }

  /** Le corps d'une carte de quête (dans la vignette de la vitrine). */
  private questCard(c: QuestCardModel): HTMLElement {
    const facts: (HTMLElement | null)[] = [...c.cardNeeds.map((n) => this.questNeed(n)), c.place === null ? null : this.questPlace(c.place)];
    const reward = c.rewards[0];
    return el('span', { class: 'lpl-quest-card' }, [
      this.questFace(c, 'small'),
      el('span', { class: 'lpl-quest-card__title', text: c.title }),
      el('span', { class: 'lpl-quest-card__step', text: c.step }),
      c.done ? null : el('span', { class: 'lpl-quest-card__facts' }, facts),
      c.done || reward === undefined ? null : el('span', { class: 'lpl-quest-card__reward' }, [pastille({ icon: reward.icon, text: reward.text, tone: reward.tone, label: '' })]),
    ]);
  }

  /** Détail de la quête choisie: le visage en grand, le texte complet, les conditions, le lieu, la récompense, le secret. */
  private questDetail(c: QuestCardModel): (Node | null)[] {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const status = c.withdrawn
      ? pastille({ icon: 'ui-cross', text: ctx.t(ctx.texts.extra.notebook.annonceExpired), tone: 'info' })
      : c.done
        ? pastille({ icon: 'ui-check', text: ctx.t(ctx.texts.game.ui.questDone), tone: 'ok' })
        : c.current
          ? pastille({ icon: 'ui-pin', text: ctx.t(v.questCurrent), tone: 'wait' })
          : null;
    return [
      el('div', { class: 'lpl-quest-detail__head' }, [this.questFace(c, 'large'), el('h3', { class: 'lpl-detail__name', text: c.title })]),
      status,
      c.text === '' ? null : el('p', { class: 'lpl-quest-detail__text', text: c.text }),
      // Conditions, lieu et récompense sur une même rangée (qui passe à la ligne s'il le faut).
      c.needs.length === 0 && c.place === null && c.rewards.length === 0
        ? null
        : el('div', { class: 'lpl-quest-detail__needs' }, [
            ...c.needs.map((n) => this.questNeed(n)),
            c.place === null ? null : pastille({ icon: 'ui-pin', text: c.place.label, tone: 'info', label: c.place.label }),
            ...c.rewards.map((r) => pastille({ icon: r.icon, text: r.text, tone: r.tone, label: r.label })),
          ]),
      ...this.secretCard(c.secret),
    ];
  }

  /**
   * Fiche de la quête à secret (R16), glissée sous l'objectif comme un billet: le secret chez
   * l'informé (« Rien que pour toi »), une invitation à demander chez l'autre, le secret chez
   * les deux à la fin. Le contenu vient de `secretViewOf`, qui ne le donne qu'à qui peut le lire.
   */
  private secretCard(view: SecretView | null): HTMLElement[] {
    if (view === null) return [];
    const head = el('span', { class: 'lpl-secret__head' }, [
      icon('ui-whisper'),
      el('strong', { class: 'lpl-secret__title', text: view.title }),
      secretStamp(view.chip),
    ]);
    if (view.kind === 'ask') {
      return [el('span', { class: 'lpl-secret', 'data-kind': 'ask' }, [head, el('span', { class: 'lpl-secret__help', text: view.text })])];
    }
    const lines = el(
      'span',
      { class: 'lpl-secret__lines' },
      view.lines.map((line) => el('span', { class: 'lpl-secret__line', text: line })),
    );
    const extra: HTMLElement[] = [];
    if (view.kind === 'mine' && view.nudge !== null) extra.push(el('span', { class: 'lpl-secret__nudge' }, [icon('ui-whisper'), view.nudge]));
    if (view.kind === 'mine' && view.help !== '') extra.push(el('span', { class: 'lpl-secret__help', text: view.help }));
    return [el('span', { class: 'lpl-secret', 'data-kind': view.kind }, [head, lines, ...extra])];
  }

  /** Ligne « Aujourd'hui » en tête des quêtes: la confidence du matin, chez son destinataire seul. */
  private hintCard(hint: MomentHintModel): HTMLElement {
    const { ctx } = this.host;
    return el('div', { class: 'lpl-confidence lpl-confidence--notebook', role: 'note' }, [
      el('span', { class: 'lpl-confidence__head' }, [
        icon('ui-whisper'),
        el('strong', { class: 'lpl-confidence__overline', text: ctx.t(ctx.texts.game.ui.momentHint) }),
        secretStamp(hint.chip),
      ]),
      el('p', { class: 'lpl-confidence__text', text: hint.text }),
      el('p', { class: 'lpl-confidence__help', text: hint.help }),
    ]);
  }

  private renderMail(letters: ReturnType<typeof letterModels>): void {
    const { ctx } = this.host;
    const n = ctx.texts.extra.notebook;
    if (this.letter === null || !letters.some((l) => l.id === this.letter)) {
      this.letter = letters[defaultLetter(letters)]?.id ?? null;
    }
    const selected = letters.find((l) => l.id === this.letter) ?? null;
    if (selected?.unread === true) this.host.send({ type: 'read_letter', letter: selected.id });
    const sig = JSON.stringify(['mail', letters.map((l) => [l.id, l.unread, l.title]), this.letter]);
    this.renderBody(sig, () => {
      if (letters.length === 0) return [el('div', { class: 'lpl-empty' }, [icon('ui-letter'), ctx.t(n.noLetters)])];
      const list = el('ul', { class: 'lpl-letter-list', 'data-nav': 'list', 'aria-label': n.lettersLabel });
      for (const l of letters) {
        list.append(
          el('li', {}, [
            // Titre d'abord (une ligne, coupé par des points de suspension), puis l'expéditeur et le jour (section 5.2).
            button([icon('ui-letter'), el('strong', { class: 'lpl-letter-item__title', text: l.title }), el('small', { class: 'lpl-letter-item__meta', text: l.meta })], () => {
              this.letter = l.id;
              this.host.invalidate();
            }, {
              class: 'lpl-letter-item',
              attrs: {
                'data-nav-item': true,
                'data-key': `letter:${l.id}`,
                'aria-label': l.label,
                title: l.title,
                'aria-current': String(l.id === this.letter),
                'data-state': l.unread && l.id !== this.letter ? 'unread' : null,
                'data-autofocus': l.id === this.letter,
              },
            }),
          ]),
        );
      }
      const article =
        selected === null
          ? null
          : el('article', { class: 'lpl-letter', 'aria-label': ctx.t(n.letterOf, { from: selected.from }) }, [
              el('span', { class: 'lpl-stamp', text: selected.from }),
              el('p', { class: 'lpl-letter__from', text: selected.title }),
              el('p', { text: ctx.t(`« ${selected.text} »`) }),
            ]);
      return [el('div', { class: 'lpl-mail' }, [list, article])];
    });
  }

  /**
   * Sac (patch 0.12.2): les cases en vignettes (quantité et belle qualité en pastilles), et le
   * détail de la case choisie en icônes: usage, prix chez Odette, ce qu'on en fait. La barre
   * d'outils garde sa rangée; Espace ou le glisser-déposer déplacent, Entrée fait l'action principale.
   */
  private renderBag(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const n = ctx.texts.extra.notebook;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const occupied = me.bag.map((s) => s !== null);
    if (this.checked === null || this.checked >= me.bag.length) this.checked = defaultBagSlot(occupied, me.selected);
    const slots = me.bag.map((_, i) => slotModel(ctx, me, i));
    const checkedStack = me.bag[this.checked] ?? null;
    const detail = checkedStack === null ? null : itemDetail(ctx, checkedStack);
    const price = checkedStack === null || (ctx.content.items[checkedStack.item]?.sellPrice ?? null) === null ? null : grocerPrice(ctx, checkedStack.item, checkedStack.quality, 1, world);
    const sig = JSON.stringify(['bag', slots, this.checked, this.moving, detail, price]);
    this.renderBody(sig, () => {
      const toolbar = el('div', { class: 'lpl-bag-grid lpl-bag-grid--toolbar', role: 'group', 'aria-label': ctx.t(n.toolbar) });
      const rest = el('div', { class: 'lpl-bag-grid', role: 'group', 'aria-label': ctx.t(n.bag, { count: me.bag.length - UI_SETTINGS.toolbarSlots }), style: `--lpl-columns: ${UI_SETTINGS.bagColumns}` });
      slots.forEach((s, i) => {
        (i < UI_SETTINGS.toolbarSlots ? toolbar : rest).append(this.bagSlot(s, i));
      });
      const slotsBox = el('div', { class: 'lpl-bag__slots', 'data-nav': 'grid' }, [
        el('p', { class: 'lpl-overline', text: ctx.t(n.toolbar) }),
        toolbar,
        el('p', { class: 'lpl-overline', text: ctx.t(n.bag, { count: me.bag.length - UI_SETTINGS.toolbarSlots }) }),
        rest,
      ]);
      let aside: HTMLElement;
      if (bagEmpty(me)) {
        aside = el('div', { class: 'lpl-empty lpl-bag__detail' }, [icon('grain-sack', 'lpl-icon lpl-empty__icon'), ctx.t(n.bagEmpty)]);
      } else if (detail === null || checkedStack === null) {
        aside = el('aside', { class: 'lpl-vitrine__detail lpl-bag__detail', 'aria-label': n.detailLabel }, [
          detailFigure('grain-sack', 'lpl-detail__figure--empty'),
          el('p', { class: 'lpl-detail__line', text: ctx.t(ctx.texts.extra.common.emptySlot) }),
        ]);
      } else {
        aside = el('aside', { class: 'lpl-vitrine__detail lpl-bag__detail', 'aria-label': n.detailLabel }, this.bagDetail(checkedStack, detail, price));
      }
      const nodes: (Node | null)[] = [el('div', { class: 'lpl-bag' }, [slotsBox, aside])];
      if (bagFull(me)) {
        nodes.push(el('div', { style: 'margin-top: 0.75rem' }, [el('p', { class: 'lpl-toast lpl-toast--error', style: 'animation: none' }, [icon('ui-warning'), ctx.t(n.bagFull)])]));
      }
      return nodes;
    });
  }

  /** Détail de la case choisie: dessin, nom, une ligne, puis tout en pastilles, et les boutons. */
  private bagDetail(stack: NonNullable<ReadonlyWorld['characters'][number]['bag'][number]>, detail: ReturnType<typeof itemDetail>, price: number | null): (Node | null)[] {
    const { ctx } = this.host;
    const n = ctx.texts.extra.notebook;
    const v = ctx.texts.extra.vitrine;
    const index = this.checked ?? 0;
    const facts = itemFacts(ctx, stack.item);
    const list: (PastilleSpec | null)[] = [
      detail.fine ? { icon: 'ui-star', text: '', tone: 'price', label: ctx.t(v.fineLabel) } : null,
      stack.count > 1 ? { icon: 'grain-sack', text: `×${String(stack.count)}`, tone: 'count', label: ctx.t(ctx.texts.extra.common.inBag, { count: stack.count }) } : null,
      price === null
        ? { icon: CURRENCY.icon, text: '', tone: 'missing', crossed: true, label: ctx.t(v.odetteNo) }
        : { icon: CURRENCY.icon, text: String(price), tone: 'price', label: ctx.t(v.odettePrice, { price }) },
      ...facts.map((f): PastilleSpec => ({ icon: f.icon, text: f.text, tone: f.tone, label: f.label })),
    ];
    const buttons: HTMLElement[] = detail.actions.map((a, i) => {
      const label = a === 'eat' ? ctx.t(n.eat, { amount: detail.eatAmount }) : a === 'read' ? ctx.t(n.read) : ctx.t(n.hold);
      return button(i === 0 ? [label, ' ', keycap(ctx.key('Enter'))] : label, () => {
        this.runAction(a, index, stack.item);
      }, { class: `lpl-button${i === 0 ? ' lpl-button--primary' : ''}`, attrs: { 'data-key': `action:${a}`, 'data-nav-item': true } });
    });
    buttons.push(
      button([this.moving === null ? ctx.t(n.move) : ctx.t(n.moving, { key: ctx.key('Space') }), ' ', keycap(ctx.key('Space'))], () => {
        this.toggleMove(index);
        focusElement(this.body.querySelector<HTMLElement>(`[data-slot="${index}"]`));
      }, { attrs: { 'data-key': 'action:move', 'data-nav-item': true, 'aria-pressed': this.moving === null ? 'false' : 'true' } }),
    );
    return [...detailHead(detail.icon, capitalize(itemTitle(ctx.content.items[stack.item], 1, stack.item)), detail.meta), pastilles(list), detailActions(buttons)];
  }

  private bagSlot(s: ReturnType<typeof slotModel>, index: number): HTMLButtonElement {
    const selected = index === this.checked;
    const b = button([], () => {
      if (this.moving !== null) {
        this.toggleMove(index);
        return;
      }
      // Vitrine: un premier clic choisit la case, un clic sur la case déjà choisie fait l'action principale.
      const again = this.pressed.selected;
      this.pressed.selected = false;
      if (again && s.item !== null) {
        this.primary(index);
        return;
      }
      this.checked = index;
      this.host.invalidate();
    }, {
      class: `lpl-tile lpl-tile--bag${s.item === null ? ' lpl-tile--empty' : ''}${this.moving === index ? ' lpl-tile--moving' : ''}`,
      attrs: {
        'data-nav-item': true,
        'data-slot': String(index),
        'data-key': `slot:${index}`,
        'aria-label': s.label,
        'aria-current': selected ? 'true' : null,
        'data-selected': selected ? 'true' : null,
        'data-autofocus': selected,
        'data-quality': s.fine ? 'fine' : null,
        draggable: s.item === null ? null : 'true',
        [SOUND_ATTR]: 'none',
      },
    });
    if (s.icon !== null) b.append(el('span', { class: 'lpl-tile__figure', 'aria-hidden': 'true' }, [icon(s.icon, 'lpl-tile__icon')]));
    if (s.count > 1) b.append(el('span', { class: 'lpl-tile__badge', 'aria-hidden': 'true' }, [pastille({ icon: null, text: `×${String(s.count)}`, tone: 'count' })]));
    if (s.fine) b.append(el('span', { class: 'lpl-tile__corner lpl-tile__corner--fine', 'aria-hidden': 'true' }, [icon('ui-star')]));
    if (s.gauge !== null) b.append(el('span', { class: 'lpl-tile__gauge', 'aria-hidden': 'true', style: `--lpl-value: ${Math.round(s.gauge * 100)}%` }));
    if (s.item !== null) b.append(el('span', { class: 'lpl-tile__name', 'aria-hidden': 'true', text: capitalize(itemTitle(this.host.ctx.content.items[s.item], 1, s.item)) }));
    b.addEventListener('pointerdown', () => {
      this.pressed.selected = this.checked === index;
    });
    // Le focus est la sélection (règle de la vitrine): le détail suit les flèches.
    b.addEventListener('focus', () => {
      if (this.checked === index) return;
      this.checked = index;
      this.host.invalidate();
    });
    // Glisser-déposer entre deux cases.
    b.addEventListener('dragstart', (e) => {
      this.dragFrom = index;
      e.dataTransfer?.setData('text/plain', String(index));
    });
    b.addEventListener('dragover', (e) => {
      if (this.dragFrom !== null) e.preventDefault();
    });
    b.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = this.dragFrom;
      this.dragFrom = null;
      if (from !== null && from !== index) {
        this.host.send({ type: 'swap_slots', from, to: index });
        this.checked = index;
        this.host.invalidate();
      }
    });
    b.addEventListener('dragend', () => {
      this.dragFrom = null;
    });
    return b;
  }
}
