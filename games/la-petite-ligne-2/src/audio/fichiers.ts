/**
 * Adresses servies des fichiers sonores (Vite): tout fichier posé sous `assets/commun/son/` est
 * servi, il suffit qu'une table le nomme (`effets/page.ogg`).
 */
const URLS = import.meta.glob<string>('../../assets/commun/son/**/*.ogg', {
  query: '?url',
  import: 'default',
  eager: true,
});

const PREFIX = '../../assets/commun/son/';

export function soundUrl(file: string): string | null {
  return URLS[`${PREFIX}${file}`] ?? null;
}
