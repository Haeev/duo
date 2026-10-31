// Menu d'application minimal en français sous macOS (ADR 0003, point 8). Sous
// Windows, aucun menu: Alt, Ctrl+R, Ctrl+W et les outils de développement restent
// neutralisés.
import { Menu, type MenuItemConstructorOptions } from 'electron';

export function buildApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Duo',
      submenu: [
        { role: 'about', label: 'À propos de Duo' },
        { type: 'separator' },
        { role: 'hide', label: 'Masquer Duo' },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter Duo' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Présentation',
      submenu: [{ role: 'togglefullscreen', label: 'Plein écran', accelerator: 'Ctrl+Command+F' }],
    },
    {
      label: 'Fenêtre',
      submenu: [
        { role: 'minimize', label: 'Réduire' },
        { role: 'zoom', label: 'Agrandir' },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
