/**
 * Écran du socle: un plan vu du dessus du lieu courant, dessiné en 2D, en attendant le rendu 3D
 * (lot L4) et l'interface (lot L7). Il montre ce que l'état contient: lieu, jour, heure, objets,
 * habitants et les deux joueurs. À supprimer quand `rendu/` et `interface/` sont branchés.
 */
import type { GameView } from '../session';

const BACKGROUND = '#1d2433';
const GROUND = '#2f4a3c';
const BLOCKED = '#151a26';
const OBJECT = '#c9a26b';
const VILLAGER = '#e9e2d0';
const TEXT = '#f3ead8';
const MARGIN = 56;

function clockText(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return `${hours} h ${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
}

export function drawBaseScreen(
  canvas: HTMLCanvasElement,
  view: GameView,
  colors: readonly [string, string],
): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const ratio = window.devicePixelRatio;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  context.fillStyle = TEXT;
  context.font = `${16 * ratio}px sans-serif`;
  context.textBaseline = 'top';
  const world = view.world();
  if (world === null) {
    context.fillText(
      'La Petite Ligne (refonte): en attente de l’état de l’hôte',
      16 * ratio,
      16 * ratio,
    );
    return;
  }
  const place = view.content.places[world.common.place];
  const state = world.places[world.common.place];
  if (place === undefined || state === undefined) return;
  const role = view.role === 'host' ? 'hôte' : 'invité';
  context.fillText(
    `La Petite Ligne (refonte), socle: ${place.def.name}, jour ${world.common.day}, ${clockText(world.minutes)}, ${role}, pas ${world.tick}`,
    16 * ratio,
    16 * ratio,
  );
  const margin = MARGIN * ratio;
  const scale = Math.min(
    (width - margin * 2) / place.map.width,
    (height - margin * 2) / place.map.height,
  );
  const left = (width - place.map.width * scale) / 2;
  const top = (height - place.map.height * scale) / 2 + margin / 4;
  context.fillStyle = GROUND;
  context.fillRect(left, top, place.map.width * scale, place.map.height * scale);
  context.fillStyle = BLOCKED;
  for (const r of place.map.blocked)
    context.fillRect(left + r.x * scale, top + r.y * scale, r.w * scale, r.h * scale);
  context.fillStyle = OBJECT;
  for (const object of place.map.objects)
    context.fillRect(
      left + (object.x - 0.4) * scale,
      top + (object.y - 0.4) * scale,
      0.8 * scale,
      0.8 * scale,
    );
  const dot = (x: number, y: number, color: string, radius: number): void => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(left + x * scale, top + y * scale, radius * scale, 0, Math.PI * 2);
    context.fill();
  };
  for (const villager of Object.values(state.villagers))
    dot(villager.body.x, villager.body.y, VILLAGER, 0.35);
  world.players.forEach((player, index) => {
    dot(player.body.x, player.body.y, colors[index] ?? TEXT, 0.45);
  });
}
