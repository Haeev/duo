/**
 * Modèle de l'interface des parcelles libres (0.13, `parcelles-libres-0-13.md` section 5): le
 * compteur « posées/possédées » au-dessus de la barre, la pastille des parcelles libres sur la case
 * du cordeau, et ce qui suit le pointeur pendant un tracé (pastille du compteur prévisionnel, raison
 * d'un refus, anneau du maintien). Fonctions pures, lues par `hud.ts` et testées dans Node.
 */
import {
  type PlotRefusal,
  PLOT_REFUSAL_TEXT,
  gardenCellAtIn,
  plotSettings,
  plotsFree,
  plotsOwned,
  plotsPlaced,
  previewPlacement,
} from '../etat/parcelles';
import type { ReadonlyWorld } from '../etat/types';
import type { PlotPreview } from '../etat/vue';
import type { UiContext } from './contexte';
import { itemIcon } from './modele';

export interface PlotCounterModel {
  placed: number;
  owned: number;
  free: number;
  /** Au plafond (`max` des réglages): le cadenas doré, pas un manque. */
  atCap: boolean;
  text: string;
  label: string;
}

/** Le compteur des parcelles (section 5.2), `null` sans parcelles libres dans les réglages. */
export function plotCounter(world: ReadonlyWorld, ctx: UiContext): PlotCounterModel | null {
  const s = plotSettings(ctx.content);
  if (s === null) return null;
  const owned = plotsOwned(ctx.content, world);
  const placed = plotsPlaced(world);
  const t = ctx.texts.extra.plots;
  const atCap = owned >= s.max;
  return {
    placed,
    owned,
    free: plotsFree(ctx.content, world),
    atCap,
    text: ctx.t(t.counter, { placed, owned }),
    label: ctx.t(atCap ? t.capLabel : t.counterLabel, { placed, owned }),
  };
}

/** Icône de chaque raison de refus (section 5.1): la couleur n'est jamais seule. */
export const PLOT_REFUSAL_ICONS: Readonly<Record<PlotRefusal, { icon: string; crossed: boolean }>> = {
  outside: { icon: 'ui-fence-crossed', crossed: false },
  occupied: { icon: 'crate', crossed: true },
  hens: { icon: 'hen', crossed: false },
  goat: { icon: 'goat', crossed: false },
  friche: { icon: 'hoe', crossed: false },
  exists: { icon: 'ui-plot', crossed: false },
  ground_item: { icon: 'ui-hand', crossed: false },
  none: { icon: 'ui-plot', crossed: true },
};

export interface PlotCursorModel {
  /** Pastille du compteur prévisionnel d'un rectangle (« +5 », ou « +7 » barré avec « 10/10 »). */
  plus: { text: string; crossed: boolean; counter: string | null; label: string } | null;
  /** La raison du refus de la case visée (une seule case), icône et mot. */
  reason: { icon: string; crossed: boolean; text: string } | null;
  /** L'anneau du maintien de reprise: avancée et ce qui reviendra au sac. */
  hold: { progress: number; icon: string; label: string } | null;
}

/** Ce qui suit le pointeur (ou s'affiche au-dessus de la barre au clavier) pendant que le cordeau est en main. */
export function plotCursor(world: ReadonlyWorld, ctx: UiContext, preview: PlotPreview | null): PlotCursorModel | null {
  if (preview === null || preview.cells.length === 0) return null;
  const t = ctx.texts.extra.plots;
  const out: PlotCursorModel = { plus: null, reason: null, hold: null };
  if (preview.mode === 'place') {
    const states = previewPlacement(ctx.content, ctx.map, world, preview.cells);
    if (preview.cells.length > 1) {
      const valid = states.filter((s) => s.kind !== 'refused').length;
      const extra = states.filter((s) => s.kind === 'extra').length;
      const free = plotsFree(ctx.content, world);
      const counter = plotCounter(world, ctx);
      out.plus = {
        text: ctx.t(t.plus, { count: valid }),
        crossed: extra > 0,
        counter: extra > 0 && counter !== null ? counter.text : null,
        label: extra > 0 ? ctx.t(t.overLabel, { count: valid, free }) : ctx.t(t.plusLabel, { count: valid }),
      };
    } else {
      const first = states[0];
      if (first?.kind === 'refused') {
        const look = PLOT_REFUSAL_ICONS[first.reason];
        out.reason = { icon: look.icon, crossed: look.crossed, text: ctx.t(ctx.texts.messages[PLOT_REFUSAL_TEXT[first.reason]] ?? '') };
      }
    }
  }
  if (preview.hold !== null) {
    const cell = preview.cells[0];
    const g = cell === undefined ? null : gardenCellAtIn(world, cell);
    const crop = g?.crop ?? null;
    const def = crop === null ? undefined : ctx.content.crops[crop.crop];
    if (def !== undefined && crop !== null) {
      out.hold = {
        progress: preview.hold,
        icon: itemIcon(ctx, crop.ripe ? def.harvest : def.seed),
        label: ctx.t(crop.ripe ? t.holdHarvest : t.holdSeed),
      };
    }
  }
  return out.plus === null && out.reason === null && out.hold === null ? null : out;
}
