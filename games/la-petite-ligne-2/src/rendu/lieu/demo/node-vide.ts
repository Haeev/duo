/** Remplace `node:fs` et `node:url` dans la page de démonstration: l'outil n'y lit ni n'écrit rien. */
export function readFileSync(): string {
  throw new Error('lecture de fichier indisponible dans la page');
}
export function writeFileSync(): void {
  throw new Error('écriture de fichier indisponible dans la page');
}
export function fileURLToPath(url: string | URL): string {
  return String(url);
}
