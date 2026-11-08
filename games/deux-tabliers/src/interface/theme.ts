/**
 * Style de l'interface (bible artistique, section 10): capsules et panneaux opaques expresso,
 * liseré filet, texte crème; or de Duo pour l'action principale; ardoise à la craie (Caveat),
 * tickets et livre d'or à la main (Patrick Hand, Caveat). Polices OFL embarquées par
 * `@fontsource` (aucun CDN). Aucun flou, aucun panneau semi-transparent, rien sous 14 px.
 *
 * Taille: `--dt-scale` (taille d'interface de Duo fois « Taille des textes »), plafonnée à un
 * trentième de la hauteur pour le HUD (ux 3.1).
 */
import '@fontsource-variable/dm-sans/standard.css';
import '@fontsource-variable/jost/wght.css';
import '@fontsource-variable/caveat/wght.css';
import '@fontsource/patrick-hand/latin-400.css';
import '@fontsource/patrick-hand/latin-ext-400.css';

export const CSS = `
:root {
  --dt-scale: 1;
  --dt-expresso: #2B211C;
  --dt-expresso-2: #3A2D26;
  --dt-filet: #5C4A3E;
  --dt-creme: #F6EEDF;
  --dt-creme-2: #CDBBA6;
  --dt-or: #FFC857;
  --dt-succes: #6BD69A;
  --dt-erreur: #FF6B81;
  --dt-craie: #F1EDE3;
  --dt-craie-jaune: #E9C98A;
  --dt-ardoise: #2F3634;
  --dt-page: #F2E8D2;
  --dt-encre: #2B2622;
  --dt-papier: #FBF6EA;
  --dt-ambre: #E0A030;
  --dt-ui: 'DM Sans Variable', 'DM Sans', system-ui, sans-serif;
  --dt-titre: 'Jost Variable', 'Jost', system-ui, sans-serif;
  --dt-main: 'Caveat Variable', 'Caveat', cursive;
  --dt-ticket: 'Patrick Hand', cursive;
}
.dt-readable { --dt-main: var(--dt-ui); --dt-ticket: var(--dt-ui); }
.dt-hud [hidden], .dt-backdrop [hidden], .dt-screen [hidden] { display: none !important; }
.dt-icon { width: 1.15em; height: 1.15em; flex: none; vertical-align: -0.2em; }
.dt-token { width: 1.35em; height: 1.35em; flex: none; vertical-align: -0.3em; }
.dt-kbd { display: inline-block; min-width: 1.5em; padding: 0 0.35em; border: 1px solid currentColor; border-radius: 0.3em; font: 600 0.85em/1.45 var(--dt-ui); text-align: center; margin: 0 0.15em; }
.dt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* HUD */
.dt-hud { position: fixed; inset: 0; pointer-events: none; font-family: var(--dt-ui); color: var(--dt-creme); font-size: min(calc(1rem * var(--dt-scale)), calc(100vh / 30)); line-height: 1.3; z-index: 10; }
.dt-card { background: var(--dt-expresso); border: 1px solid var(--dt-filet); border-radius: 0.7em; padding: 0.5em 0.75em; box-shadow: 0 0.15em 0.5em rgba(0,0,0,0.35); }
.dt-card.dashed { border: 2px dashed var(--dt-creme-2); }
.dt-second { color: var(--dt-creme-2); }
.dt-region { position: absolute; display: flex; flex-direction: column; gap: 0.45em; }
.dt-tl { left: 1em; top: 1em; width: 15em; }
/* Le haut au centre tient entre la colonne de gauche (15em) et celle de droite (14,5em): l'astuce passe à la ligne au lieu de glisser sous la carte de l'autre. */
.dt-tc { left: 50%; top: 1em; width: max(9em, min(19em, calc(100% - 2 * (15em + 2em)))); transform: translateX(-50%); align-items: stretch; overflow-wrap: anywhere; }
.dt-tr { right: 1em; top: 1em; width: 14.5em; }
.dt-br { right: 1em; bottom: 3.5em; width: 14em; }
.dt-clock-time { display: flex; align-items: center; gap: 0.4em; font: 600 1.45em/1.1 var(--dt-titre); }
.dt-clock-sub { font-size: 0.9em; margin-top: 0.15em; }
.dt-label-chip { align-self: flex-start; padding: 0.1em 0.5em; border-radius: 0.3em; background: var(--dt-creme); color: var(--dt-expresso); font: 700 0.8em/1.4 var(--dt-ui); letter-spacing: 0.06em; text-transform: uppercase; }
.dt-ticket-head { display: flex; align-items: center; gap: 0.4em; font-weight: 700; }
.dt-ticket-head .dt-wait { margin-left: auto; font-weight: 600; font-size: 0.9em; }
.dt-ticket-line { display: flex; align-items: center; gap: 0.4em; font-size: 0.95em; }
.dt-box { display: inline-block; width: 0.85em; height: 0.85em; border: 1.5px solid currentColor; border-radius: 0.15em; flex: none; position: relative; }
.dt-box.done::after { content: ''; position: absolute; left: 0.22em; top: 0.02em; width: 0.25em; height: 0.5em; border: solid currentColor; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.dt-ticket-status { font-weight: 700; font-size: 0.9em; margin-top: 0.2em; }
.dt-alert { display: flex; gap: 0.5em; align-items: flex-start; }
.dt-alert .dt-icon { color: var(--dt-or); margin-top: 0.1em; }
.dt-hint { border-style: dashed; }
.dt-partner-head { display: flex; align-items: center; gap: 0.4em; font-weight: 700; }
.dt-partner-head .dt-dir { margin-left: auto; width: 1.3em; height: 1.3em; }
.dt-proposal { pointer-events: auto; cursor: pointer; }
.dt-proposal strong { display: block; }
.dt-held-title { font: 700 0.8em/1.4 var(--dt-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dt-creme-2); }
.dt-timer { display: flex; align-items: center; gap: 0.5em; }
.dt-ring { width: 1.4em; height: 1.4em; border-radius: 50%; flex: none; }
.dt-dot { position: absolute; left: 50%; top: 50%; width: 0.6em; height: 0.6em; transform: translate(-50%, -50%); border-radius: 50%; background: var(--dt-creme); border: 2px solid var(--dt-expresso); }
.dt-dot.small { width: 0.45em; height: 0.45em; }
.dt-dot.large { width: 0.8em; height: 0.8em; }
.dt-dot.aim { width: 1.5em; height: 1.5em; background: transparent; border: 0.2em solid var(--dt-creme); box-shadow: 0 0 0 2px var(--dt-expresso), inset 0 0 0 2px var(--dt-expresso); }
.dt-hold { position: absolute; left: 50%; top: 50%; width: 3.8em; height: 3.8em; transform: translate(-50%, -50%); border-radius: 50%; -webkit-mask: radial-gradient(circle, transparent 58%, #000 60%); mask: radial-gradient(circle, transparent 58%, #000 60%); }
.dt-gauge { position: absolute; left: 50%; top: 50%; width: 6em; height: 6em; transform: translate(-50%, -50%); }
.dt-gauge-label { position: absolute; left: 50%; top: calc(50% - 5.2em); transform: translateX(-50%); white-space: nowrap; }
.dt-prompt { position: absolute; left: 50%; top: calc(50% + 2.2em); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 0.15em; max-width: 26em; text-align: center; border-radius: 1.2em; padding: 0.35em 0.9em; }
.dt-prompt-main { display: flex; align-items: center; gap: 0.35em; white-space: nowrap; }
.dt-prompt.refused { border: 2px dashed var(--dt-creme-2); }
.dt-reading { position: absolute; left: 50%; bottom: calc(50% + 1.6em); transform: translateX(-50%); width: 16em; background: var(--dt-papier); color: var(--dt-encre); border: 2px solid var(--dt-encre); }
.dt-reading .dt-ticket-line, .dt-reading .dt-hand { font-family: var(--dt-ticket); font-size: 1.1em; }
.dt-quality { position: absolute; left: calc(50% + 2.4em); top: calc(50% - 0.8em); padding: 0.15em 0.6em; border-radius: 1em; }
.dt-capsule { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 0.9em 1.5em; border-radius: 2em; text-align: center; font-size: 1.1em; }
.dt-capsule small { display: block; margin-top: 0.3em; font-size: 0.85em; color: var(--dt-creme-2); }
.dt-flash { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); border: 2px dashed var(--dt-creme-2); border-radius: 2em; display: flex; gap: 0.4em; align-items: center; }
.dt-fail { position: absolute; inset: 10%; padding: 20px; background: var(--dt-expresso); border: 1px solid var(--dt-filet); white-space: pre-wrap; overflow: auto; pointer-events: auto; }
.dt-fps { position: absolute; left: 0.5em; bottom: 0.5em; font: 600 0.85em/1.3 var(--dt-ui); padding: 0.1em 0.5em; border-radius: 0.4em; }
.dt-bubble { position: absolute; left: 50%; bottom: 7.5em; transform: translateX(-50%); width: max(16em, min(34em, calc(100% - 2 * (14em + 2em)))); pointer-events: auto; }
/* Réplique affichée: la capsule « Clique pour reprendre la souris » monte au-dessus d'elle. */
.dt-hud:has(.dt-bubble:not([hidden])) .dt-capsule { top: 30%; }
/* Fenêtre étroite (deux vues côte à côte, petit écran): la carte de l'autre descend au-dessus de
   « En main », l'astuce prend la place libre en haut à droite, la réplique se cale à gauche. */
.dt-hud { container: dt-hud / size; }
@container dt-hud (max-width: 52em) {
  .dt-tr { top: auto; bottom: 9.5em; }
  .dt-tc { left: 17em; right: 1em; width: auto; transform: none; }
  .dt-bubble { left: 1em; transform: none; width: calc(100% - 18.5em); }
}
.dt-bubble-who { font: 700 0.95em/1.3 var(--dt-titre); color: var(--dt-or); }
.dt-bubble-text { font-size: 1.1em; margin: 0.2em 0 0.4em; }
.dt-bubble ol { margin: 0.2em 0 0.3em; padding-left: 1.4em; }
.dt-bubble li.sel { color: var(--dt-or); font-weight: 700; }
.dt-private { margin-top: 0.4em; padding: 0.35em 0.6em; border-radius: 0.5em; border: 2px dashed var(--dt-or); display: flex; gap: 0.4em; }
.dt-countdown { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); font: 600 1.4em/1.2 var(--dt-titre); }

/* Panneaux posés */
.dt-backdrop { position: fixed; inset: 0; background: rgba(20, 14, 10, 0.55); z-index: 20; font-family: var(--dt-ui); font-size: calc(1rem * var(--dt-scale)); line-height: 1.35; color: var(--dt-creme); }
.dt-backdrop.fade { animation: dt-fade 150ms ease-out; }
@keyframes dt-fade { from { opacity: 0; } to { opacity: 1; } }
.dt-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(62em, 94vw); max-height: 92vh; display: flex; flex-direction: column; background: var(--dt-expresso); border: 1px solid var(--dt-filet); border-radius: 1.1em; box-shadow: 0 0.6em 2em rgba(0,0,0,0.45); overflow: hidden; }
.dt-panel.narrow { width: min(36em, 94vw); }
.dt-panel-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em 1em; padding: 0.9em 1.3em 0.6em; border-bottom: 1px solid var(--dt-filet); }
.dt-panel-head h2 { margin: 0; font: 600 1.55em/1.15 var(--dt-titre); }
.dt-panel-body { flex: 1; overflow: auto; padding: 0.9em 1.3em; min-height: 0; }
.dt-panel-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3em 1.1em; padding: 0.55em 1.3em 0.75em; border-top: 1px solid var(--dt-filet); color: var(--dt-creme-2); font-size: 0.875em; }
.dt-panel h3 { margin: 0.2em 0 0.5em; font: 600 1.2em/1.2 var(--dt-titre); }
.dt-panel h4 { margin: 0.8em 0 0.35em; font: 700 0.8em/1.3 var(--dt-ui); letter-spacing: 0.07em; text-transform: uppercase; color: var(--dt-creme-2); }
.dt-panel p { margin: 0.25em 0 0.5em; }
.dt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4em; font: 600 0.95em/1.2 var(--dt-ui); color: var(--dt-creme); background: var(--dt-expresso-2); border: 2px solid var(--dt-creme-2); border-radius: 0.55em; padding: 0.45em 0.85em; cursor: pointer; min-height: 2.2em; }
.dt-btn:hover { background: #4A3A31; }
.dt-btn:disabled, .dt-btn:disabled[aria-pressed="true"] { cursor: default; border-style: dashed; color: var(--dt-creme-2); background: transparent; border-color: var(--dt-creme-2); }
.dt-backdrop input[type="range"], .dt-screen input[type="range"] { accent-color: var(--dt-or); width: 9em; }
.dt-btn-primary { background: var(--dt-or); color: var(--dt-expresso); border-color: var(--dt-or); }
.dt-btn-primary:hover { background: #FFD47A; }
.dt-btn[aria-pressed="true"], .dt-btn[aria-checked="true"], .dt-btn[aria-selected="true"] { background: var(--dt-creme); color: var(--dt-expresso); border-color: var(--dt-creme); }
.dt-backdrop :focus-visible, .dt-backdrop .dt-focus { outline: 3px solid var(--dt-or); outline-offset: 2px; }
.dt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15em, 1fr)); gap: 0.8em; }
.dt-tile { border: 1px solid var(--dt-filet); border-radius: 0.8em; padding: 0.7em 0.9em; background: var(--dt-expresso-2); display: flex; flex-direction: column; gap: 0.35em; }
.dt-tile h3 { display: flex; gap: 0.4em; align-items: center; font-size: 1.05em; margin: 0; }
.dt-tile .dt-btn { align-self: flex-start; }
.dt-row { display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; }
.dt-chip { display: inline-flex; align-items: center; gap: 0.35em; padding: 0.15em 0.6em; border: 1px solid var(--dt-creme-2); border-radius: 1em; font-size: 0.9em; }
.dt-chip.dashed { border-style: dashed; }
.dt-banner { border: 2px dashed var(--dt-creme-2); border-radius: 0.6em; padding: 0.4em 0.7em; display: flex; gap: 0.5em; align-items: center; margin-bottom: 0.7em; }
.dt-table { width: 100%; border-collapse: collapse; }
.dt-table th { text-align: left; font-size: 0.85em; color: var(--dt-creme-2); font-weight: 600; padding: 0.3em 0.4em; border-bottom: 1px solid var(--dt-filet); }
.dt-table td { padding: 0.35em 0.4em; border-bottom: 1px solid var(--dt-filet); }
.dt-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.dt-stepper { display: inline-flex; align-items: center; gap: 0.35em; }
.dt-stepper .dt-btn { padding: 0.2em 0.45em; min-height: 1.9em; min-width: 1.9em; }
.dt-input { font: 1em/1.3 var(--dt-ui); color: var(--dt-creme); background: var(--dt-expresso-2); border: 2px solid var(--dt-creme-2); border-radius: 0.5em; padding: 0.45em 0.6em; width: 100%; box-sizing: border-box; }
.dt-error { color: var(--dt-erreur); display: flex; gap: 0.35em; align-items: center; }
.dt-ok { color: var(--dt-succes); display: flex; gap: 0.35em; align-items: center; }

/* Tablette */
.dt-tablet { display: grid; grid-template-columns: 12em 1fr; min-height: 0; flex: 1; }
.dt-tablet nav { border-right: 1px solid var(--dt-filet); padding: 0.8em 0.6em; display: flex; flex-direction: column; gap: 0.25em; overflow: auto; }
.dt-tab { display: flex; align-items: center; gap: 0.55em; text-align: left; font: 500 1em/1.2 var(--dt-ui); color: var(--dt-creme); background: transparent; border: 2px solid transparent; border-radius: 0.55em; padding: 0.45em 0.6em; cursor: pointer; }
.dt-tab[aria-selected="true"] { border-color: var(--dt-creme-2); background: var(--dt-expresso-2); font-weight: 700; }
.dt-tab .dt-count { margin-left: auto; min-width: 1.4em; border: 1.5px solid currentColor; border-radius: 1em; font-size: 0.8em; text-align: center; }
.dt-tablet section { overflow: auto; padding: 0.9em 1.3em; min-height: 0; }
.dt-setting { display: grid; grid-template-columns: 1fr auto; gap: 0.2em 1em; align-items: center; padding: 0.55em 0; border-bottom: 1px solid var(--dt-filet); }
.dt-setting .dt-second { grid-column: 1 / -1; font-size: 0.875em; }
.dt-seg { display: inline-flex; gap: 0.3em; flex-wrap: wrap; }
.dt-switch { min-width: 4.2em; }

/* Ardoise */
.dt-slate { display: grid; grid-template-columns: 1fr 1.25fr; gap: 1em; min-height: 0; }
.dt-recipe { display: flex; align-items: center; gap: 0.6em; border: 1px solid var(--dt-filet); border-radius: 0.6em; padding: 0.45em 0.7em; margin-bottom: 0.4em; background: var(--dt-expresso-2); }
.dt-recipe div { flex: 1; }
.dt-recipe .dt-second { font-size: 0.875em; }
.dt-board { background: var(--dt-ardoise); border: 0.5em solid #7A5A3E; border-radius: 0.6em; padding: 0.8em 1em; color: var(--dt-craie); }
.dt-board h3 { font-family: var(--dt-main); font-size: 1.7em; color: var(--dt-craie-jaune); margin: 0; }
.dt-board .dt-input { background: #3A4240; border-color: var(--dt-craie); color: var(--dt-craie); font-family: var(--dt-main); font-size: 1.3em; }
.dt-board .dt-btn { background: transparent; border-color: var(--dt-craie); color: var(--dt-craie); }
.dt-board .dt-btn[aria-pressed="true"] { background: var(--dt-craie); color: var(--dt-ardoise); }
.dt-board .dt-btn:disabled { border-color: #A6ABA6; color: #C9CCC6; background: transparent; }
.dt-board .dt-second { color: #D3D6CF; }
.dt-line { display: grid; grid-template-columns: 1fr auto; gap: 0.15em 0.8em; align-items: center; padding: 0.5em 0; border-bottom: 1px dashed #8C948F; }
.dt-line-name { font: 600 1.55em/1.1 var(--dt-main); }
.dt-line-price { font: 600 1.45em/1 var(--dt-main); color: var(--dt-craie-jaune); min-width: 3.2em; text-align: center; }
.dt-line .dt-second { grid-column: 1 / -1; font-size: 0.875em; }
.dt-line.soldout .dt-line-name { text-decoration: line-through; }
.dt-lock { display: inline-flex; gap: 0.3em; align-items: center; border: 2px dashed var(--dt-craie); border-radius: 0.5em; padding: 0.1em 0.5em; font-size: 0.875em; }

/* Bilan et livre d'or */
.dt-pages { display: flex; gap: 0.4em; align-items: center; }
.dt-pagedot { width: 1.7em; height: 1.7em; border-radius: 50%; border: 2px solid var(--dt-creme-2); display: inline-flex; align-items: center; justify-content: center; font-size: 0.85em; font-weight: 700; }
.dt-pagedot.on { background: var(--dt-creme); color: var(--dt-expresso); border-color: var(--dt-creme); }
.dt-words { display: grid; grid-template-columns: repeat(auto-fill, minmax(17em, 1fr)); gap: 0.8em; }
.dt-word { background: var(--dt-page); color: var(--dt-encre); border-radius: 0.6em; padding: 0.7em 0.9em; border: 2px solid #8A7A66; }
.dt-word-text { font: 500 1.45em/1.25 var(--dt-main); }
.dt-word-sign { font: 1.1em/1.3 var(--dt-ticket); margin-top: 0.3em; display: flex; gap: 0.5em; align-items: center; }
.dt-word-sign .dt-chip { border-color: var(--dt-encre); font-family: var(--dt-ui); font-size: 0.75em; font-weight: 700; }
.dt-word-subject { font-size: 0.875em; margin-top: 0.3em; display: flex; gap: 0.35em; align-items: center; color: #4A3F35; }
.dt-figures { display: grid; grid-template-columns: repeat(auto-fill, minmax(11em, 1fr)); gap: 0.6em; }
.dt-figure { border: 1px solid var(--dt-filet); border-radius: 0.6em; padding: 0.5em 0.7em; background: var(--dt-expresso-2); }
.dt-figure strong { display: block; font: 600 1.45em/1.2 var(--dt-titre); }
.dt-cups { display: inline-flex; gap: 0.15em; }

/* Écrans de choix (première fois, matin, nuit, fin) */
.dt-screen { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(20, 14, 10, 0.72); font-family: var(--dt-ui); font-size: calc(1rem * var(--dt-scale)); color: var(--dt-creme); }
.dt-screen.fade { animation: dt-fade 300ms ease-out; }
.dt-poster { background: var(--dt-papier); color: var(--dt-encre); border: 2px solid var(--dt-encre); padding: 1em 1.4em; transform: rotate(-1.2deg); max-width: 26em; margin: 0 auto 1em; }
.dt-poster strong { display: block; font: 700 1.9em/1.1 var(--dt-main); }
.dt-poster p { font: 1.25em/1.3 var(--dt-ticket); margin: 0.4em 0 0; }
.dt-letter { background: var(--dt-page); color: var(--dt-encre); border-radius: 0.4em; padding: 1.1em 1.4em; font: 1.4em/1.35 var(--dt-main); border: 2px solid #8A7A66; }
.dt-letter p { margin: 0 0 0.55em; }
.dt-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8em; margin: 0.6em 0; }
.dt-who { border: 1px solid var(--dt-filet); border-radius: 0.6em; padding: 0.5em 0.7em; display: flex; gap: 0.5em; align-items: center; }
.dt-avatars { display: flex; gap: 0.5em; flex-wrap: wrap; }
.dt-avatar { width: 3.4em; height: 3.4em; }
.dt-reduced .fade { animation: none; }
`;

/** Installe la feuille de style une fois; renvoie de quoi la retirer. */
export function installStyle(): () => void {
  const style = document.createElement('style');
  style.dataset.dt = 'interface';
  style.textContent = CSS;
  document.head.append(style);
  return () => {
    style.remove();
  };
}

/** Taille des textes: Duo (100, 125, 150 %) fois le réglage du joueur. */
export function applyScale(scale: number, reducedMotion: boolean, readable: boolean): void {
  document.documentElement.style.setProperty('--dt-scale', String(scale));
  document.documentElement.classList.toggle('dt-reduced', reducedMotion);
  document.documentElement.classList.toggle('dt-readable', readable);
}
