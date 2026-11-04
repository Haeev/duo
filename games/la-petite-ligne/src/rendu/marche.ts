/**
 * Le marché du dimanche et les plis de Lucie à l'écran (0.12, lot L-économie): l'étal sur la place
 * une fois la quête `market_stall` finie, ses cagettes et ce qu'elles portent, la balance si le duo
 * l'a achetée, et la sacoche de Lucie sur le banc du quai tant qu'il y reste des plis.
 *
 * Modèles de l'artiste (`marche.glb`): `market_stall` (clients devant, +Z; extras `crate_spots`,
 * `scale_spot`), `market_crate` (fond à `goods_height`), `market_scale`, `mail_bag` (`rest_height`).
 * Tout se lit dans l'état: mêmes images chez les deux joueurs. Les copies partagent géométries et
 * matériaux avec la bibliothèque: rien à libérer. À la fermeture (R18, 0.12.2), les produits
 * restants s'enfoncent dans leurs cagettes avant de disparaître: on voit l'étal se ranger.
 */
import { Group, type Object3D } from 'three';
import type { Content } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import { stallPose, stallSetUp, stallSlots } from '../etat/marche';
import type { ReadonlyWorld } from '../etat/types';
import type { FrameContext, RenderPart } from './contexte';
import { yawFromQuarter } from './contexte';
import type { ModelLibrary } from './modeles';
import { applyShadows } from './ombre-tri';
import type { Terrain } from './terrain';

const STALL = 'market_stall';
const CRATE = 'market_crate';
const SCALE = 'market_scale';
const MAIL_BAG = 'mail_bag';
/** Le banc du quai où Firmin pose la sacoche (`reglages.mailRound.point`). */
const BENCH_PROP = 'quay_bench';
/** La sacoche au bout est du banc (m depuis son centre): Jeanne s'assoit au milieu le matin. */
const BAG_ALONG = 0.65;
/** Trois objets au plus par cagette, en rang (m entre deux). */
const GOODS_PER_CRATE = 3;
const GOODS_STEP = 0.11;
/** Rangement de l'étal à 13 h: durée (s) et profondeur (m) dont les produits descendent dans la cagette. */
const STOW_SECONDS = 0.7;
const STOW_DROP = 0.08;

type Triple = readonly [number, number, number];

function triples(value: unknown): Triple[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Triple => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number'),
  );
}

function triple(value: unknown): Triple | null {
  return triples([value])[0] ?? null;
}

export class MarketPart implements RenderPart {
  readonly group = new Group();
  private readonly stall: Object3D | null = null;
  private readonly stallGoods = new Group();
  private readonly bag: Object3D | null = null;
  private signature = '';
  /** Produits posés (pour le rangement de la fermeture), avec leur hauteur et leur taille de repos. */
  private readonly goods: { object: Object3D; y: number; scale: number }[] = [];
  /** Début du rangement en cours (temps du rendu), `null` sans rangement. */
  private stowStart: number | null = null;

  constructor(
    map: GameMap,
    private readonly content: Content,
    private readonly library: ModelLibrary,
    terrain: Terrain,
  ) {
    this.group.name = 'marché';
    const pose = stallPose(content, map);
    if (pose !== null && library.has(STALL)) {
      const stall = library.instantiate(STALL);
      stall.position.set(
        pose.centre.x,
        terrain.heightAt(pose.centre.x, pose.centre.y),
        pose.centre.y,
      );
      // Les clients devant (+Z du modèle), du côté de `front` (vers l'est de la place).
      stall.rotation.y = Math.atan2(pose.front.x, pose.front.y);
      applyShadows(stall);
      stall.visible = false;
      stall.add(this.stallGoods);
      this.group.add(stall);
      this.stall = stall;
    }
    const bench = map.props.find((p) => p.id === BENCH_PROP);
    if (bench !== undefined && library.has(MAIL_BAG)) {
      const bag = library.instantiate(MAIL_BAG);
      const yaw = yawFromQuarter(bench.rotation);
      const rest = Number(library.extras(MAIL_BAG).rest_height ?? 0.45);
      const x = bench.pos.x + Math.cos(yaw) * BAG_ALONG;
      const y = bench.pos.y - Math.sin(yaw) * BAG_ALONG;
      bag.position.set(x, terrain.heightAt(x, y) + rest, y);
      bag.rotation.y = yaw;
      applyShadows(bag);
      bag.visible = false;
      this.group.add(bag);
      this.bag = bag;
    }
  }

  update(context: FrameContext): void {
    const world = context.world;
    if (this.bag !== null) {
      const mail = world.mail;
      this.bag.visible = mail?.day === world.clock.day && mail.items.some((p) => p.taken !== true);
    }
    if (this.stall === null) return;
    const shown = stallSetUp(this.content, world);
    this.stall.visible = shown;
    if (!shown) return;
    const signature = this.goodsSignature(world);
    if (this.stowStart !== null) {
      if (!this.stow(context)) return;
      this.signature = signature;
      this.rebuildGoods(world);
      return;
    }
    if (signature === this.signature) return;
    if (this.goods.length > 0 && this.justClosed(world) && !context.reducedMotion) {
      // L'étal vient d'être rangé: les produits gardés à l'écran descendent dans leurs cagettes.
      this.stowStart = context.time;
      return;
    }
    this.signature = signature;
    this.rebuildGoods(world);
  }

  /** L'étal du jour vient de fermer (heure de fermeture passée, plus rien dessus). */
  private justClosed(world: ReadonlyWorld): boolean {
    const m = this.content.market;
    const market = world.market;
    return (
      m !== null &&
      market !== null &&
      market.day === world.clock.day &&
      world.clock.minutes >= m.closes &&
      market.stall.length === 0
    );
  }

  /** Une image du rangement; vrai quand il est fini (les produits sont alors retirés). */
  private stow(context: FrameContext): boolean {
    const t = (context.time - (this.stowStart ?? context.time)) / STOW_SECONDS;
    if (t >= 1) {
      this.stowStart = null;
      return true;
    }
    const k = t * t * (3 - 2 * t);
    for (const g of this.goods) {
      g.object.position.y = g.y - STOW_DROP * k;
      g.object.scale.setScalar(g.scale * Math.max(0.01, 1 - k));
    }
    return false;
  }

  private goodsSignature(world: ReadonlyWorld): string {
    const stall = world.market?.stall ?? [];
    return `${String(stallSlots(this.content, world))}|${String(this.scaleOwned(world))}|${stall.map((s) => `${s.item}:${String(s.count)}`).join(',')}`;
  }

  private scaleOwned(world: ReadonlyWorld): boolean {
    const item = this.content.market?.scaleItem;
    if (item === undefined) return false;
    return (
      world.cellar.some((s) => s.item === item) ||
      world.characters.some((c) => c.bag.some((s) => s?.item === item))
    );
  }

  private rebuildGoods(world: ReadonlyWorld): void {
    this.stallGoods.clear();
    this.goods.length = 0;
    const extras = this.library.extras(STALL);
    const spots = triples(extras.crate_spots).slice(0, stallSlots(this.content, world));
    const goodsHeight = Number(this.library.extras(CRATE).goods_height ?? 0.012);
    const stall = world.market?.stall ?? [];
    for (const [i, spot] of spots.entries()) {
      const crate = this.library.instantiate(CRATE);
      crate.position.set(spot[0], spot[1], spot[2]);
      this.stallGoods.add(crate);
      const stack = stall[i];
      if (stack === undefined) continue;
      const model = this.content.items[stack.item]?.model ?? stack.item;
      const n = Math.min(GOODS_PER_CRATE, stack.count);
      for (let k = 0; k < n; k++) {
        const good = this.library.instantiate(model);
        good.position.set(spot[0] + (k - (n - 1) / 2) * GOODS_STEP, spot[1] + goodsHeight, spot[2]);
        this.stallGoods.add(good);
        this.goods.push({ object: good, y: good.position.y, scale: good.scale.x });
      }
    }
    const scaleSpot = triple(extras.scale_spot);
    if (scaleSpot !== null && this.scaleOwned(world) && this.library.has(SCALE)) {
      const scale = this.library.instantiate(SCALE);
      scale.position.set(scaleSpot[0], scaleSpot[1], scaleSpot[2]);
      this.stallGoods.add(scale);
    }
    applyShadows(this.stallGoods);
  }
}
