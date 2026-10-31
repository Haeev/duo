// Autorisations (ADR 0003, point 6): tout est refusé, sauf le plein écran et le
// verrouillage du pointeur pour la session des jeux.
import type { Session } from 'electron';

const GAME_PERMISSIONS = new Set(['fullscreen', 'pointerLock']);

export function hardenSession(target: Session, options: { readonly allowGamePermissions: boolean }): void {
  const allowed = (permission: string): boolean =>
    options.allowGamePermissions && GAME_PERMISSIONS.has(permission);
  target.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(allowed(permission));
  });
  target.setPermissionCheckHandler((_contents, permission) => allowed(permission));
  target.on('will-download', (event) => {
    event.preventDefault();
  });
}
