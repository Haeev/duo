/**
 * Panneau « Boutique et réserve » du mode aménagement (Tab en mode aménagement): acheter par
 * palier, la brocante de la semaine, les extensions et les revêtements, sortir une pièce de la
 * réserve, répondre à une proposition de l'autre, voir l'ambiance en mots. Version provisoire en
 * attendant les onglets de la tablette (chantier d), qui peuvent reprendre `catalogView`.
 */
import type { Panel } from '../../interface/panneaux';
import type { GameView } from '../../reseau/vue';
import type { Intent } from '../../simulation/entrees';
import { ambianceNow, catalogView, placedCount } from '../index';

const CSS = `
.dt-shop { min-width: min(720px, 80vw); font-size: 14px; }
.dt-shop h3 { margin: 14px 0 6px; font-size: 15px; }
.dt-shop ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; }
.dt-shop li { padding: 6px 8px; border: 1px solid #d9cbb5; border-radius: 8px; background: #fbf7f0; }
.dt-shop li.off { opacity: 0.6; }
.dt-shop .meta { font-size: 12px; color: #6b5d50; }
.dt-shop button { margin-top: 4px; font: inherit; }
.dt-shop .rooms { margin: 6px 0; }
`;

const SHELF_LABEL: Readonly<Record<string, string>> = {
  extension: 'Agrandir le café',
  t0: 'À l’arrivée',
  t1: 'Deux tasses',
  t2: 'Deux tasses et demie',
  t3: 'Trois tasses',
  brocante: 'Brocante du lundi (-30 %)',
};

const STYLE_LABEL: Readonly<Record<string, string>> = {
  campagne: 'campagne',
  jardin: 'jardin',
  nordique: 'nordique',
  retro: 'rétro',
  bistrot: 'bistrot',
  atelier: 'atelier',
  neutre: 'simple',
};

export function createArrangementPanel(
  send: (intent: Intent) => void,
  closePanel: () => void,
): Panel & { readonly id: 'amenagement' } {
  let style: HTMLStyleElement | null = null;
  let room = 'salle';
  let lastKey = '';
  let rootRef: HTMLElement | null = null;
  let viewRef: GameView | null = null;

  const render = (): void => {
    const root = rootRef;
    const view = viewRef;
    if (root === null || view === null) return;
    const { content } = view;
    const world = view.world();
    const a = world.arrangement;
    root.querySelector('.dt-shop')?.remove();
    const box = document.createElement('div');
    box.className = 'dt-shop';
    const amb = ambianceNow(content, world);
    const head = document.createElement('p');
    head.textContent = `Ambiance : ${amb.label}. ${placedCount(content, world)} objets posés sur ${content.arrangement.rules.objectLimit}. ${amb.hints[0] ?? ''}`;
    box.append(head);

    const proposal = a.proposal;
    if (proposal !== null) {
      const item =
        content.arrangement.items.get(proposal.item) ??
        content.arrangement.extensions.get(proposal.item);
      const p = document.createElement('p');
      if (proposal.player === view.local)
        p.textContent = `Tu as proposé : ${item?.label ?? proposal.item} (${proposal.price} €). En attente de la réponse.`;
      else {
        p.textContent = `On t’a proposé : ${item?.label ?? proposal.item} (${proposal.price} €). `;
        const yes = button('D’accord', () => {
          send({ type: 'amenagement-repondre', accept: true });
        });
        const no = button('Pas maintenant', () => {
          send({ type: 'amenagement-repondre', accept: false });
        });
        p.append(yes, document.createTextNode(' '), no);
      }
      box.append(p);
    }

    if (a.stock.length > 0) {
      const h = document.createElement('h3');
      h.textContent = 'Réserve';
      const ul = document.createElement('ul');
      for (const piece of a.stock) {
        const label = content.furniture.get(piece.type)?.label ?? piece.type;
        const li = document.createElement('li');
        li.append(
          label,
          document.createElement('br'),
          button('Placer', () => {
            send({ type: 'amenagement-sortir', piece: piece.id });
            closePanel();
          }),
        );
        ul.append(li);
      }
      box.append(h, ul);
    }
    const pending = a.orders.length;
    if (pending > 0 || a.works.length > 0) {
      const p = document.createElement('p');
      p.className = 'meta';
      const parts: string[] = [];
      if (pending > 0)
        parts.push(
          `${pending} carton${pending > 1 ? 's' : ''} livré${pending > 1 ? 's' : ''} demain matin dans la cour`,
        );
      for (const w of a.works)
        parts.push(
          `travaux : ${content.arrangement.extensions.get(w.extension)?.label ?? w.extension}, fini le jour ${w.readyDay}`,
        );
      p.textContent = `${parts.join(' · ')}.`;
      box.append(p);
    }

    const rooms = document.createElement('div');
    rooms.className = 'rooms';
    rooms.append('Revêtements pour : ');
    for (const r of content.arrangement.rooms.filter(
      (x) => !x.outdoor && (x.extension === null || a.extensions.includes(x.extension)),
    )) {
      const b = button(r.label, () => {
        room = r.id;
        lastKey = '';
        render();
      });
      b.disabled = r.id === room;
      rooms.append(b, ' ');
    }
    box.append(rooms);

    const shelves = new Map<string, HTMLUListElement>();
    for (const e of catalogView(content, world, room)) {
      let ul = shelves.get(e.shelf);
      if (ul === undefined) {
        ul = document.createElement('ul');
        shelves.set(e.shelf, ul);
      }
      const li = document.createElement('li');
      if (e.refusal !== null) li.className = 'off';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${e.price ?? '?'} € · style ${STYLE_LABEL[e.style] ?? e.style}${e.heavy ? ' · à porter à deux' : ''}`;
      const title = document.createElement('strong');
      title.textContent = e.label;
      li.append(title, meta);
      li.title = e.text;
      const covering =
        e.category === 'paint' || e.category === 'wallpaper' || e.category === 'floor';
      if (e.refusal === null)
        li.append(
          button('Acheter', () => {
            send({ type: 'amenagement-acheter', item: e.id, room: covering ? room : null });
          }),
        );
      else {
        const why = document.createElement('div');
        why.className = 'meta';
        why.textContent = e.refusal;
        li.append(why);
      }
      ul.append(li);
    }
    for (const [shelf, ul] of shelves) {
      const h = document.createElement('h3');
      h.textContent = SHELF_LABEL[shelf] ?? shelf;
      box.append(h, ul);
    }
    // Sous le titre du panneau, au-dessus du bouton de fermeture.
    const title = root.querySelector('h2');
    if (title === null) root.prepend(box);
    else title.after(box);
  };

  return {
    id: 'amenagement',
    open(root, view) {
      style = document.createElement('style');
      style.textContent = CSS;
      document.head.append(style);
      rootRef = root;
      viewRef = view;
      const title = document.createElement('h2');
      title.textContent = 'Boutique et réserve';
      root.append(title);
      lastKey = '';
      render();
    },
    update(view) {
      // Redessiné seulement quand le domaine change (achat, livraison, proposition).
      const a = view.world().arrangement;
      const key = `${a.stock.length}|${a.orders.length}|${a.works.length}|${a.extensions.length}|${a.proposal?.item ?? ''}|${a.brocante.items.length}|${Object.keys(a.walls).length}|${Object.keys(a.floors).length}|${view.world().clientele.day}`;
      if (key === lastKey) return;
      lastKey = key;
      render();
    },
    close() {
      style?.remove();
      style = null;
      rootRef = null;
    },
  };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
