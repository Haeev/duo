// Lecture du manifeste du jeu servi (`duo-game.json` à côté de sa page d'entrée).
import { parseManifest, type GameManifest } from '@duo/protocol';

export async function loadManifest(gameUrl: string): Promise<GameManifest> {
  const url = new URL('duo-game.json', new URL(gameUrl, location.href));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Manifeste introuvable: ${url.href} (${response.status})`);
  }
  const result = parseManifest(await response.json());
  if (!result.ok) {
    throw new Error(`Manifeste invalide:\n${result.issues.join('\n')}`);
  }
  return result.manifest;
}

export function showFatal(container: HTMLElement, message: string): void {
  const box = document.createElement('pre');
  box.className = 'erreur';
  box.textContent = message;
  container.replaceChildren(box);
}
