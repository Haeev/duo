// Avis de nouvelle version de Duo (M-35, ADR 0011 section 3.6), vu par l'interface.
// L'adresse à ouvrir reste dans le processus principal: la vue n'envoie que
// « Télécharger » ou « Plus tard ».

/**
 * `download`: installateur de ce système (`Duo-macOS.dmg`, `Duo-Windows.exe`).
 * `page`: aucun installateur pour ce système dans la release, page de la release.
 * `unsupported`: le système de la machine est trop ancien pour cette version.
 */
export type AppUpdateView =
  | {
      readonly kind: 'download';
      readonly version: string;
      readonly summary: string;
      readonly file: string;
    }
  | { readonly kind: 'page'; readonly version: string; readonly summary: string }
  | {
      readonly kind: 'unsupported';
      readonly version: string;
      readonly summary: string;
      readonly system: 'macOS' | 'Windows';
      readonly minimum: string;
    };
