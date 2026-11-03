/**
 * Interface de secours, en attendant celle de `src/interface/`: de quoi jouer
 * la démo d'un bout à l'autre (heure, bourse, objectif, messages, dialogues,
 * menus simples, petit-déjeuner, nuit, fin). Sobre, en DOM, sans style
 * travaillé; elle disparaît dès que l'interface du jeu est livrée.
 */
import type { Intent } from '../etat/actions';
import { letterText, letterTitle } from '../etat/courrier';
import type { ItemStack, MenuKind, ReadonlyWorld } from '../etat/types';
import { TOOLBAR_SLOTS } from '../etat/types';
import type { CreateInterface, GameInterface, GameView, InterfaceOptions } from '../etat/vue';
import { format } from '../simulation/contexte';

const MINUTES_PER_HOUR = 60;
/** Rafraîchissement du texte (images entre deux mises à jour du DOM). */
const REFRESH_FRAMES = 6;

function text(view: GameView, path: string[], fallback: string): string {
  let node: unknown = view.content.texts.raw;
  for (const key of path) node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  return typeof node === 'string' ? node : fallback;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.style.cssText = css;
  parent.appendChild(node);
  return node;
}

function itemLabel(view: GameView, s: ItemStack): string {
  const def = view.content.items[s.item];
  const name = def === undefined ? s.item : s.count > 1 ? def.plural : def.name;
  return `${s.count} ${name}${s.quality === 'fine' ? ' *' : ''}`;
}

const PANEL = 'position:absolute;background:rgba(20,22,40,0.82);color:#f4efe6;font:15px system-ui,sans-serif;padding:8px 12px;border-radius:8px;pointer-events:auto;';
const BUTTON = 'margin:3px;padding:5px 10px;font:inherit;border-radius:6px;border:1px solid #c9b88f;background:#3a3550;color:#f4efe6;cursor:pointer;';

export const createFallbackInterface: CreateInterface = (options: InterfaceOptions): GameInterface => {
  const { view, overlay } = options;
  overlay.style.pointerEvents = 'none';
  const hud = el('div', `${PANEL}top:8px;left:8px;`, overlay);
  const toast = el('div', `${PANEL}bottom:70px;left:50%;transform:translateX(-50%);max-width:70%;display:none;`, overlay);
  const bar = el('div', `${PANEL}bottom:8px;left:50%;transform:translateX(-50%);white-space:nowrap;`, overlay);
  const panel = el('div', `${PANEL}top:50%;left:50%;transform:translate(-50%,-50%);max-width:60%;max-height:70%;overflow:auto;display:none;`, overlay);
  let frames = 0;
  let lastKey = '';

  const send = (intent: Intent): void => {
    view.send(intent);
  };
  const button = (parent: HTMLElement, label: string, intent: Intent): void => {
    const b = el('button', BUTTON, parent);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      send(intent);
    });
  };

  function renderPanel(w: ReadonlyWorld): string {
    const me = w.characters.find((c) => c.id === view.localCharacter());
    if (me === undefined) return '';
    if (w.phase === 'ended' && w.ending !== null) return `end:${w.ending.linesDone}:${String(me.endReady)}`;
    if (w.phase === 'creation') return me.created ? 'creation-wait' : 'creation';
    if (me.status === 'breakfast') return `breakfast:${w.clock.day}`;
    if (w.phase === 'night') return `night:${me.nightChoice ?? ''}`;
    if (w.scene !== null) return `scene:${w.scene.dialogue}:${w.scene.line}:${w.scene.choices.length}:${Object.keys(w.scene.picks).join()}:${w.scene.ready.join()}`;
    if (me.dialogue !== null) return `dialogue:${me.dialogue.dialogue}:${me.dialogue.line}:${me.dialogue.choices.length}`;
    if (me.menu !== null) return `menu:${me.menu}:${w.revision}`;
    return '';
  }

  function fillPanel(w: ReadonlyWorld): void {
    const me = w.characters.find((c) => c.id === view.localCharacter());
    panel.replaceChildren();
    if (me === undefined) return;
    const line = (t: string): void => {
      el('p', 'margin:4px 0;', panel).textContent = t;
    };
    if (w.phase === 'ended' && w.ending !== null) {
      line(text(view, ['endScreen', 'title'], ''));
      line(text(view, ['endScreen', 'subtitle'], ''));
      line(format(text(view, ['endScreen', 'stats', 'days'], '{days}'), { days: w.ending.days }));
      line(format(text(view, ['endScreen', 'stats', 'order'], ''), { linesDone: w.ending.linesDone, linesTotal: w.ending.linesTotal }));
      line(format(text(view, ['endScreen', 'stats', 'furniture'], ''), { furniture: w.ending.furniturePlaced }));
      line(text(view, ['endScreen', 'text'], ''));
      if (!me.endReady) button(panel, text(view, ['nightScreen', 'continue'], 'OK'), { type: 'end_ready', ready: true });
      return;
    }
    if (w.phase === 'creation') {
      if (me.created) {
        const other = w.characters.find((c) => c.id !== me.id);
        line(format(text(view, ['ui', 'creation', 'waiting'], ''), { partner: other?.name ?? '' }));
        return;
      }
      line(text(view, ['ui', 'creation', 'title'], ''));
      const input = el('input', 'font:inherit;margin:4px;', panel);
      input.value = me.name;
      input.maxLength = 16;
      const go = el('button', BUTTON, panel);
      go.type = 'button';
      go.textContent = text(view, ['ui', 'creation', 'ready'], 'OK');
      go.addEventListener('click', () => {
        send({ type: 'create_character', name: input.value, hair: 0, outfit: me.id === 'p1' ? 0 : 1 });
      });
      return;
    }
    if (me.status === 'breakfast') {
      line(text(view, ['ui', 'breakfast', 'title'], ''));
      const form = view.content.texts.form.find((f) => f.level === me.form);
      if (form !== undefined) line(`${form.name}. ${form.text}`);
      const envie = view.content.envies.find((e) => e.id === me.envie?.id);
      if (envie !== undefined) line(`${text(view, ['ui', 'breakfast', 'envie'], '')}: ${envie.text}`);
      const shared = view.content.envies.find((e) => e.id === me.sharedEnvie?.id);
      if (shared !== undefined) line(`${text(view, ['ui', 'breakfast', 'sharedEnvie'], '')}: ${shared.text}`);
      line(`${text(view, ['ui', 'breakfast', 'weather'], '')}: ${view.content.texts.weather[w.weather] ?? w.weather}`);
      button(panel, text(view, ['ui', 'breakfast', 'start'], 'OK'), { type: 'start_day' });
      return;
    }
    if (w.phase === 'night') {
      line(text(view, ['nightScreen', 'title'], ''));
      line(text(view, ['nightScreen', 'text'], ''));
      button(panel, text(view, ['nightScreen', 'continue'], ''), { type: 'night_choice', choice: 'continue' });
      button(panel, text(view, ['nightScreen', 'finish'], ''), { type: 'night_choice', choice: 'finish' });
      return;
    }
    const dialogue = w.scene ?? me.dialogue;
    if (dialogue !== null) {
      const speakerName = (id: string): string =>
        view.content.villagers.find((v) => v.id === id)?.label ?? w.characters.find((c) => c.id === id)?.name ?? '';
      const current = dialogue.lines[dialogue.line];
      if (current !== undefined) line(`${speakerName(current.speaker)}: ${current.text}`);
      if (dialogue.choices.length > 0 && dialogue.line >= dialogue.lines.length - 1) {
        for (const choice of dialogue.choices) button(panel, choice.text, { type: 'dialogue_choice', choice: choice.id });
      } else {
        button(panel, '...', { type: 'dialogue_next' });
      }
      if (w.scene === null) button(panel, 'x', { type: 'dialogue_close' });
      return;
    }
    if (me.menu !== null) fillMenu(w, me.menu);
  }

  function fillMenu(w: ReadonlyWorld, menu: MenuKind): void {
    const me = w.characters.find((c) => c.id === view.localCharacter());
    if (me === undefined) return;
    const row = (): HTMLElement => el('div', 'margin:2px 0;', panel);
    const bag = me.bag.filter((s): s is ItemStack => s !== null);
    el('p', 'margin:4px 0;font-weight:bold;', panel).textContent = `${menu} (${w.purse})`;
    switch (menu) {
      case 'shop':
        for (const item of Object.values(view.content.items)) {
          if (item.shop !== 'grocery' || item.buyPrice === null) continue;
          button(row(), `${item.name} (${item.buyPrice})`, { type: 'buy', item: item.id, count: 1 });
        }
        for (const s of bag) {
          if (view.content.items[s.item]?.sellPrice === null) continue;
          button(row(), `- ${itemLabel(view, s)}`, { type: 'sell', item: s.item, quality: s.quality, count: s.count });
        }
        break;
      case 'catalogue':
        for (const item of Object.values(view.content.items)) {
          if (item.shop !== 'catalogue' || item.buyPrice === null) continue;
          button(row(), `${item.name} (${item.buyPrice})`, { type: 'catalogue_order', item: item.id });
        }
        for (const l of w.letters) el('p', 'margin:4px 0;font-size:13px;', panel).textContent = `${letterTitle(view.content, l)}: ${letterText(view.content, l)}`;
        break;
      case 'crate':
        for (const s of bag) button(row(), `> ${itemLabel(view, s)}`, { type: 'crate_deposit', item: s.item, quality: s.quality, count: s.count });
        for (const s of w.crate) button(row(), `< ${itemLabel(view, s)}`, { type: 'crate_take', item: s.item, quality: s.quality, count: s.count });
        break;
      case 'chest':
        for (const s of bag) button(row(), `> ${itemLabel(view, s)}`, { type: 'chest_deposit', item: s.item, quality: s.quality, count: s.count });
        for (const s of w.cellar) button(row(), `< ${itemLabel(view, s)}`, { type: 'chest_take', item: s.item, quality: s.quality, count: s.count });
        break;
      case 'workbench':
      case 'stove':
        for (const r of Object.values(view.content.recipes)) {
          const station = menu === 'workbench' ? 'workbench' : 'stove';
          if (r.station !== station || !w.unlockedRecipes.includes(r.id)) continue;
          button(row(), r.name, { type: 'craft', recipe: r.id });
        }
        for (const s of bag) {
          if (view.content.items[s.item]?.dish === null) continue;
          button(row(), `${text(view, ['ui', 'stove', 'eat'], '')} ${itemLabel(view, s)}`, { type: 'eat', item: s.item });
        }
        break;
      case 'notebook':
      case 'proposal':
      case 'letter':
        for (const q of w.quests) {
          const def = view.content.quests.find((x) => x.id === q.id);
          if (def === undefined) continue;
          const step = def.steps[q.step];
          el('p', 'margin:3px 0;', panel).textContent = `${def.title}: ${q.status === 'done' ? text(view, ['ui', 'questDone'], '') : (step?.objective ?? '')}`;
        }
        for (const s of bag) el('div', 'font-size:13px;', panel).textContent = itemLabel(view, s);
        break;
      // Tour 10: le guichet du fournil et le fauteuil de Solange, au plus simple (garder sa coiffure).
      case 'bakery':
        button(row(), 'pain', { type: 'bakery_buy', item: 'bread' });
        button(row(), 'brioche', { type: 'bakery_buy', item: 'brioche' });
        break;
      case 'salon': {
        const a = me.appearance;
        button(row(), 'ok', { type: 'haircut', hair: a.hair, hairColor: a.hairColor, beard: a.beard });
        break;
      }
      // 0.12: la mercerie n'a que le bouton de fermeture dans l'interface de secours.
      case 'clothes_shop':
        break;
    }
    for (const p of w.proposals) {
      if (p.by === me.id) continue;
      button(row(), `${text(view, ['ui', 'proposal', 'accept'], 'OK')} (${p.price})`, { type: 'proposal_answer', proposal: p.id, accept: true });
      button(row(), text(view, ['ui', 'proposal', 'decline'], 'Non'), { type: 'proposal_answer', proposal: p.id, accept: false });
    }
    button(row(), text(view, ['ui', 'shop', 'close'], 'x'), { type: 'menu', menu: null });
  }

  return {
    frame() {
      frames += 1;
      if (frames % REFRESH_FRAMES !== 0) return;
      const w = view.world();
      const me = w.characters.find((c) => c.id === view.localCharacter());
      if (me === undefined) return;
      const weekday = view.content.texts.weekdays[(w.clock.day - 1) % view.content.texts.weekdays.length] ?? '';
      const h = Math.floor(w.clock.minutes / MINUTES_PER_HOUR);
      const m = Math.floor(w.clock.minutes % MINUTES_PER_HOUR);
      const goal = w.quests.find((q) => q.status === 'active');
      const goalDef = view.content.quests.find((q) => q.id === goal?.id);
      hud.textContent = `${format(text(view, ['ui', 'hud', 'day'], '{weekday} {day}'), { weekday, day: w.clock.day })}, ${format(
        text(view, ['ui', 'hud', 'time'], '{hours}:{minutes}'),
        { hours: h, minutes: String(m).padStart(2, '0') },
      )} | ${format(text(view, ['ui', 'hud', 'purse'], '{amount}'), { amount: w.purse })} | ${goalDef?.title ?? ''}`;
      bar.textContent = me.bag
        .slice(0, TOOLBAR_SLOTS)
        .map((s, i) => `${i === me.selected ? '[' : ' '}${s === null ? '-' : itemLabel(view, s)}${i === me.selected ? ']' : ' '}`)
        .join(' ');
      const last = me.notifications[me.notifications.length - 1];
      const fresh = last !== undefined && w.tick - last.tick < 30 * 6;
      toast.style.display = fresh ? 'block' : 'none';
      if (fresh) {
        toast.textContent = last.text
          .replace('{move}', ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map((k) => view.keyLabel(k)).join(' '))
          .replace('{act}', view.keyLabel('Space'))
          .replace('{examine}', view.keyLabel('KeyX'))
          .replace('{notebook}', view.keyLabel('Tab'));
      }
      const key = renderPanel(w);
      if (key !== lastKey) {
        lastKey = key;
        panel.style.display = key === '' ? 'none' : 'block';
        fillPanel(w);
      }
    },
    handleKey(code) {
      const w = view.world();
      const me = w.characters.find((c) => c.id === view.localCharacter());
      if (me === undefined) return false;
      if (code === 'Enter' && me.status === 'breakfast') {
        send({ type: 'start_day' });
        return true;
      }
      return false;
    },
    capturesMovement() {
      const w = view.world();
      return w.phase === 'creation' || w.phase === 'night';
    },
    dispose() {
      hud.remove();
      toast.remove();
      bar.remove();
      panel.remove();
    },
  };
};
