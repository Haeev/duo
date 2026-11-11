/**
 * Alerte réseau à l'écran (MA2 de la revue du 2026-11-11): jeux incompatibles ou message refusé.
 * Posée au-dessus de tout, interface comprise (celle-ci est cachée tant que l'invité n'a pas
 * d'état, justement le cas d'un jeu incompatible). Incompatibles: voile qui couvre la partie
 * arrêtée. Message refusé: bandeau en haut, fermé d'un clic.
 */
import type { SessionAlert } from '../session';

export function showNetAlert(root: HTMLElement, alert: SessionAlert): void {
  root.querySelector('[data-net-alert]')?.remove();
  const blocking = alert.kind === 'incompatible';
  const box = document.createElement('div');
  box.dataset.netAlert = alert.kind;
  box.setAttribute('role', 'alert');
  box.textContent = alert.text;
  box.style.cssText = blocking
    ? 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:15vh 15vw;background:rgba(18,22,32,0.92);color:#f3ead8;font:600 22px/1.5 sans-serif;text-align:center;'
    : 'position:fixed;top:16px;left:50%;transform:translateX(-50%);max-width:min(720px,90vw);z-index:2147483647;padding:14px 20px;border-radius:10px;background:#3a2a1e;color:#f3ead8;font:600 17px/1.45 sans-serif;text-align:center;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,0.4);';
  if (!blocking)
    box.addEventListener('click', () => {
      box.remove();
    });
  root.append(box);
}
