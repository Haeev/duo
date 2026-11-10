/**
 * Repères d'essai par-dessus le plan 2D du socle (`plateforme/ecran-socle.ts`), en attendant le
 * rendu 3D (lot L4) et l'interface (lot L7): le cap de chaque joueur, la cible de la touche
 * d'action avec son verbe, le quai, les objets au sol, l'état du voyage. À supprimer avec l'écran
 * du socle.
 */
import type { GameView } from '../session';

/** Même cadrage que l'écran du socle. */
const MARGIN = 56;
const TARGET = '#ffe08a';
const REFUSED = '#ff8a7a';
const PLATFORM = 'rgba(243, 234, 216, 0.35)';
const GROUND_ITEM = '#9fd3ff';
const TEXT = '#f3ead8';

export function drawTestMarkers(
  canvas: HTMLCanvasElement,
  view: GameView,
  colors: readonly [string, string],
): void {
  const context = canvas.getContext('2d');
  const world = view.world();
  if (context === null || world === null) return;
  const place = view.content.places[world.common.place];
  const state = world.places[world.common.place];
  if (place === undefined || state === undefined) return;
  const ratio = window.devicePixelRatio;
  const { width, height } = canvas;
  const margin = MARGIN * ratio;
  const scale = Math.min(
    (width - margin * 2) / place.map.width,
    (height - margin * 2) / place.map.height,
  );
  const left = (width - place.map.width * scale) / 2;
  const top = (height - place.map.height * scale) / 2 + margin / 4;
  const px = (x: number): number => left + x * scale;
  const py = (y: number): number => top + y * scale;

  const platform = place.map.points[place.def.station.platform];
  if (platform !== undefined) {
    context.strokeStyle = PLATFORM;
    context.lineWidth = ratio;
    context.setLineDash([4 * ratio, 4 * ratio]);
    context.beginPath();
    context.arc(
      px(platform.x),
      py(platform.y),
      place.def.station.platformRadius * scale,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.setLineDash([]);
  }

  context.fillStyle = GROUND_ITEM;
  for (const item of state.ground)
    context.fillRect(px(item.x - 0.2), py(item.y - 0.2), 0.4 * scale, 0.4 * scale);

  context.font = `${13 * ratio}px sans-serif`;
  context.textBaseline = 'bottom';
  world.players.forEach((player, index) => {
    const { x, y, facing } = player.body;
    context.strokeStyle = colors[index] ?? TEXT;
    context.lineWidth = 2 * ratio;
    context.beginPath();
    context.moveTo(px(x), py(y));
    context.lineTo(px(x + Math.cos(facing) * 0.9), py(y + Math.sin(facing) * 0.9));
    context.stroke();
    const aim = view.aim(index === 0 ? 0 : 1);
    if (aim === null) return;
    const color = aim.refusal === null ? TARGET : REFUSED;
    context.strokeStyle = color;
    context.strokeRect(px(aim.x) - 0.6 * scale, py(aim.y) - 0.6 * scale, 1.2 * scale, 1.2 * scale);
    context.fillStyle = color;
    const label = aim.refusal === null ? aim.verb : `${aim.verb} (${aim.refusal})`;
    context.fillText(`[Espace] ${label}`, px(aim.x) + 0.8 * scale, py(aim.y) - 0.5 * scale);
  });

  const local = view.localIndex();
  const lines: string[] = [];
  const travel = world.common.travel;
  if (travel !== null)
    lines.push(
      `Train vers ${travel.to} (${world.common.phase}): à bord ${travel.boarded.map((b) => (b ? 'oui' : 'non')).join(' et ')}`,
    );
  if (local !== null) {
    const me = world.players[local];
    if (me.talk !== null)
      lines.push(`Dialogue ${me.talk.dialogue} avec ${me.talk.villager}: Espace pour fermer`);
    if (me.gesture !== null) lines.push(`Geste: ${me.gesture.clip}`);
  }
  context.fillStyle = TEXT;
  context.textBaseline = 'top';
  lines.forEach((line, row) => {
    context.fillText(line, 16 * ratio, (40 + row * 18) * ratio);
  });
}
