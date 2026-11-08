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
.dt-capsule { position: absolute; z-index: 3; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 0.9em 1.5em; border-radius: 2em; text-align: center; font-size: 1.1em; }
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
.dt-compte td { padding: 0.18em 0.4em; }
.dt-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.dt-stepper { display: inline-flex; align-items: center; gap: 0.35em; }
.dt-stepper .dt-btn { padding: 0.2em 0.45em; min-height: 1.9em; min-width: 1.9em; }
.dt-input { font: 1em/1.3 var(--dt-ui); color: var(--dt-creme); background: var(--dt-expresso-2); border: 2px solid var(--dt-creme-2); border-radius: 0.5em; padding: 0.45em 0.6em; width: 100%; box-sizing: border-box; }
.dt-error { color: var(--dt-erreur); display: flex; gap: 0.35em; align-items: center; }
.dt-ok { color: var(--dt-succes); display: flex; gap: 0.35em; align-items: center; }

/* Réglages des écrans de choix (première fois) */
.dt-setting { display: grid; grid-template-columns: 1fr auto; gap: 0.2em 1em; align-items: center; padding: 0.55em 0; border-bottom: 1px solid var(--dt-filet); }
.dt-setting .dt-second { grid-column: 1 / -1; font-size: 0.875em; }
.dt-seg { display: inline-flex; gap: 0.3em; flex-wrap: wrap; }

/* Téléphone tenu en main (ux-telephone 2 et 3): vue assombrie à 28 % sous le HUD, téléphone au-dessus */
.dt-phone-dim { position: fixed; inset: 0; z-index: 5; background: rgba(18, 12, 8, 0.28); }
.dt-phone-dim.in { animation: dt-dim-in 180ms ease-out; }
.dt-phone-dim.out { animation: dt-dim-out 150ms ease-in forwards; pointer-events: none; }
@keyframes dt-dim-in { from { background: rgba(18, 12, 8, 0); } }
@keyframes dt-dim-out { to { background: rgba(18, 12, 8, 0); } }
.dt-tel {
  --noyer: #4B2F1F; --noyer-clair: #6E4A31; --laiton: #B8924F;
  position: fixed; z-index: 25; left: 54%; bottom: 0.75rem;
  font-family: var(--dt-ui); color: var(--dt-creme); line-height: 1.35;
  font-size: max(calc(1rem * var(--dt-scale)), min(calc(100vh / 54), calc(1.25rem * var(--dt-scale))));
  /* Jamais sous « En main » (coin bas droit du HUD, 15 em du HUD avec sa marge), même à 150 %.
     Fenêtre réduite (RV-06): jamais moins de 17,5 em (le contenu tient), ni plus large que la vue;
     les colonnes du HUD qu'il couvre alors se cachent tant qu'il est sorti (index.ts, fitPhone). */
  width: max(min(17.5em, calc(100vw - 1.5rem)), min(23em, 46vw, calc(2 * (46vw - 15.5 * min(calc(1rem * var(--dt-scale)), calc(100vh / 30))))));
  max-width: calc(100vw - 1.5rem);
  height: min(46em, calc(100vh - 5.4 * min(calc(1rem * var(--dt-scale)), calc(100vh / 30)) - 0.75rem));
  transform: translateX(-50%);
}
.dt-tel.in { animation: dt-tel-in 180ms cubic-bezier(.2, .8, .3, 1); }
.dt-tel.out { animation: dt-tel-out 150ms ease-in forwards; pointer-events: none; }
@keyframes dt-tel-in { from { transform: translate(-50%, 70%) rotate(6deg); opacity: 0; } }
@keyframes dt-tel-out { to { transform: translate(-50%, 70%) rotate(6deg); opacity: 0; } }
.dt-reduced .dt-tel, .dt-reduced .dt-phone-dim { animation: none; }
.dt-tel [hidden] { display: none !important; }
.dt-tel h2, .dt-tel h3, .dt-tel p { margin: 0; }
.dt-tel-coque { position: absolute; inset: 0; border-radius: 2.1em; padding: 0.6em; background: linear-gradient(100deg, var(--noyer-clair), var(--noyer) 40%, #3a2417); box-shadow: 0 0 0 0.16em var(--laiton), 0 0 0 0.22em #3b2a17, 0 1.2em 2.4em rgba(0,0,0,0.55); }
.dt-tel-ecran { position: relative; height: 100%; border-radius: 1.55em; overflow: hidden; background: var(--dt-expresso); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; box-shadow: inset 0 0 0 1px #120c08; }
/* Main provisoire: l'image rendue depuis le modèle des mains la remplacera (H4). */
.dt-tel-doigts { position: absolute; left: -1.25em; top: 54%; width: 2.2em; height: 40%; z-index: -1; pointer-events: none; }
.dt-tel-pouce { position: absolute; right: -1.15em; bottom: 16%; width: 2em; height: 5.2em; pointer-events: none; }
.dt-etat { display: flex; align-items: center; gap: 0.5em; padding: 0.55em 1.1em 0.4em; font-size: 0.875em; font-weight: 600; background: #221a15; border-bottom: 1px solid var(--dt-filet); }
.dt-etat .dt-second { font-weight: 500; }
.dt-etat-heure { font-variant-numeric: tabular-nums; }
.dt-etat-caisse { margin-left: auto; display: flex; gap: 0.35em; align-items: center; }
.dt-etat-caisse .dt-icon { color: var(--dt-or); }
.dt-corps { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--dt-filet) transparent; padding: 0.9em 1em 1em; position: relative; }
.dt-appli-tete { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3em 0.5em; position: sticky; top: -0.9em; z-index: 2; margin: -0.9em -1em 0.6em; padding: 0.9em 1em 0.5em; background: var(--dt-expresso); box-shadow: 0 1px 0 var(--dt-filet); }
.dt-appli-tete h2 { font: 600 1.35em/1.15 var(--dt-titre); }
.dt-appli-tete .dt-token { width: 1.8em; height: 1.8em; }
.dt-meme { flex-basis: 100%; display: flex; gap: 0.35em; align-items: center; font-size: 0.875em; }
.dt-intro { color: var(--dt-creme-2); font-size: 0.9375em; margin-bottom: 0.8em !important; }
.dt-petit { font-size: 0.875em; }
.dt-fort { font-weight: 600; margin-top: 0.4em !important; }
.dt-tel .dt-rubrique { font: 700 0.875em/1.3 var(--dt-ui); letter-spacing: 0.07em; text-transform: uppercase; color: var(--dt-creme-2); margin: 1em 0 0.45em; }
.dt-tel-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4em; padding: 0.45em 0.7em 0.6em; background: #221a15; border-top: 1px solid var(--dt-filet); }
.dt-tel-nav button { display: flex; align-items: center; justify-content: center; gap: 0.4em; min-height: 2.4em; border-radius: 0.7em; background: transparent; border: 1.5px solid var(--dt-filet); color: var(--dt-creme); font: 600 0.9375em/1.2 var(--dt-ui); cursor: pointer; }
.dt-tel-nav button:hover { border-color: var(--dt-creme-2); }
:where(.dt-tel button) { font-family: var(--dt-ui); font-size: 1em; color: inherit; }
.dt-tel :focus { outline: none; }
.dt-tel :focus-visible { outline: 3px solid var(--dt-or); outline-offset: 2px; box-shadow: 0 0 0 5px var(--dt-expresso); }
.dt-tel .dt-btn { min-height: 2.4em; border-radius: 0.6em; }
.dt-tel .dt-btn-lien { background: transparent; border-color: transparent; text-decoration: underline; text-underline-offset: 0.2em; }
.dt-plein { width: 100%; }
.dt-rond { width: 2.2em; height: 2.2em; min-height: 0 !important; padding: 0 !important; border-radius: 50% !important; }
.dt-carte { background: var(--dt-expresso-2); border: 1px solid var(--dt-filet); border-radius: 0.9em; padding: 0.75em 0.85em; display: grid; gap: 0.3em; }
.dt-carte + .dt-carte, .dt-carte + article, .dt-tache + .dt-tache, .dt-conv + .dt-conv { margin-top: 0.65em; }
.dt-carte h3 { font: 600 1.05em/1.2 var(--dt-titre); }
.dt-carte.attente { border: 2px dashed var(--dt-creme-2); }
.dt-carte.lue { background: transparent; }
.dt-carte-tete { display: flex; justify-content: space-between; align-items: center; gap: 0.5em; }
.dt-carte-action { margin-top: 0.2em; }
.dt-accueil-tete { display: flex; align-items: center; gap: 0.6em; margin-bottom: 0.8em; }
.dt-accueil-tete h2 { font: 600 1.25em/1.1 var(--dt-titre); }
.dt-embleme { width: 2.6em; height: 2.6em; border-radius: 50%; background: #2F4E7A; border: 2px solid var(--dt-creme); display: grid; place-items: center; flex: none; }
.dt-embleme .dt-icon { width: 1.4em; height: 1.4em; }
.dt-afaire { display: grid; gap: 0.4em; margin-top: 0.2em; }
.dt-tache, .dt-conv { width: 100%; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.55em; align-items: center; text-align: left; padding: 0.5em 0.55em; border-radius: 0.7em; border: 1.5px solid var(--dt-filet); background: var(--dt-expresso); cursor: pointer; font-size: 0.9375em; }
.dt-tache:hover, .dt-conv:hover { border-color: var(--dt-creme-2); }
.dt-tache b { display: block; color: var(--dt-or); font-size: 0.95em; margin-top: 0.1em; }
.dt-conv b { display: block; }
.dt-conv span span { display: block; font-size: 0.875em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-conv-heure { font-size: 0.875em; color: var(--dt-creme-2); display: grid; justify-items: end; gap: 0.2em; }
.dt-nonlu { width: 0.7em; height: 0.7em; border-radius: 50%; background: var(--dt-or); border: 2px solid var(--dt-expresso); }
.dt-grille { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.7em 0.2em; margin-top: 0.9em; }
.dt-app { display: grid; justify-items: center; align-content: start; gap: 0.3em; padding: 0.3em 0; border-radius: 0.8em; border: 0; background: transparent; cursor: pointer; text-align: center; font: 600 0.875em/1.2 var(--dt-ui); position: relative; }
.dt-app:hover .dt-app-dot { box-shadow: 0 0 0 2px var(--dt-creme-2), inset 0 -0.2em 0 rgba(0,0,0,0.25); }
.dt-app-dot { width: 3.3em; height: 3.3em; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--dt-expresso); box-shadow: inset 0 -0.2em 0 rgba(0,0,0,0.25), inset 0 0.15em 0 rgba(255,255,255,0.35); border: 2px solid #1a120d; }
.dt-app-dot .dt-icon { width: 1.55em; height: 1.55em; }
.dt-app-dot.small { width: 2em; height: 2em; }
.dt-app-dot.small .dt-icon { width: 1.15em; height: 1.15em; }
.dt-badge { position: absolute; top: 0; right: calc(50% - 2.2em); min-width: 1.6em; height: 1.6em; padding: 0 0.3em; border-radius: 1em; background: var(--dt-creme); color: var(--dt-expresso); border: 2px solid var(--dt-expresso); font-size: 1em; font-weight: 800; display: grid; place-items: center; z-index: 1; }
/* Teintes d'émail des pastilles (à valider par directeur-artistique, H7); le nom est toujours écrit. */
.c-commandes { background: #E9C98A; } .c-reserve { background: #C9D7B0; } .c-catalogue { background: #E6C2A6; }
.c-carte { background: #F1EDE3; } .c-remises { background: #F2B8A0; } .c-connaitre { background: #B9D3E4; }
.c-bilans { background: #D9CDE8; } .c-projets { background: #F3D9A4; } .c-messages { background: #A8DCC4; } .c-reglages { background: #D5CEC6; }
.dt-ligne { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.2em 0.6em; padding: 0.6em 0; border-top: 1px solid var(--dt-filet); align-items: center; }
.dt-carte > h3 + .dt-ligne, .dt-fournisseur + .dt-ligne, .dt-rubrique + .dt-ligne { border-top: 0; }
.dt-ligne.carte-prix { grid-template-columns: minmax(0, 1fr) auto; }
.dt-ligne-nom { font-weight: 600; }
.dt-ligne-info, .dt-ligne-action, .dt-verrou { grid-column: 1 / -1; }
.dt-ligne-info { color: var(--dt-creme-2); font-size: 0.875em; }
.dt-verrou { display: flex; gap: 0.4em; align-items: center; font-size: 0.875em; }
.dt-ligne.tenue { box-shadow: inset 3px 0 0 var(--dt-creme-2); padding-left: 0.6em; }
.dt-pas { display: inline-flex; align-items: center; gap: 0.35em; }
.dt-pas output { min-width: 3.6em; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }
.dt-pas-ligne { display: flex; justify-content: space-between; align-items: center; gap: 0.5em; }
.dt-prix { font-variant-numeric: tabular-nums; white-space: nowrap; }
.dt-ambre { color: #F2B94B; }
.dt-douce { display: flex; gap: 0.45em; align-items: flex-start; background: #3d3020; border: 1px solid #7a5e2c; border-radius: 0.7em; padding: 0.55em 0.7em; font-size: 0.9375em; margin: 0.6em 0 !important; }
.dt-douce .dt-icon { color: var(--dt-or); margin-top: 0.05em; }
.dt-douce.ok .dt-icon, .dt-tel .ok { color: var(--dt-succes); }
.dt-fournisseur { display: flex; gap: 0.6em; align-items: center; }
.dt-portrait { width: 2.4em; height: 2.4em; border-radius: 50%; flex: none; display: grid; place-items: center; font: 600 1em var(--dt-titre); color: var(--dt-expresso); background: #E9C98A; border: 2px solid var(--dt-creme-2); }
.dt-port { font-size: 0.875em; margin-top: 0.3em !important; display: flex; gap: 0.35em; align-items: center; }
.dt-collant { position: sticky; bottom: -1em; margin: 0.9em -1em -1em; padding: 0.7em 1em 0.9em; background: var(--dt-expresso); box-shadow: 0 -1px 0 var(--dt-filet); display: grid; gap: 0.35em; z-index: 2; }
.dt-total { display: flex; justify-content: space-between; font-weight: 700; }
.dt-puces { display: flex; gap: 0.35em; overflow-x: auto; padding: 0.15em 0.1em 0.3em; margin-top: 0.2em; scrollbar-width: thin; }
.dt-puce { flex: none; min-height: 2.2em; min-width: 2.6em; padding: 0.2em 0.6em; border-radius: 1.1em; border: 1.5px solid var(--dt-creme-2); background: transparent; cursor: pointer; font: 600 0.9em/1.2 var(--dt-ui); }
.dt-puce[aria-pressed="true"], .dt-puce[aria-checked="true"] { background: var(--dt-creme); color: var(--dt-expresso); border-color: var(--dt-creme); }
.dt-puce:disabled { border-style: dashed; cursor: default; }
.dt-inter { display: inline-flex; align-items: center; gap: 0.45em; cursor: pointer; background: transparent; border: 0; padding: 0.2em; font: 600 0.9375em/1.2 var(--dt-ui); flex: none; }
.dt-inter:disabled { cursor: default; color: var(--dt-creme-2); }
.dt-inter-piste { width: 2.6em; height: 1.45em; border-radius: 1em; border: 2px solid var(--dt-creme-2); position: relative; flex: none; }
.dt-inter-piste::after { content: ''; position: absolute; top: 0.15em; left: 0.17em; width: 0.95em; height: 0.95em; border-radius: 50%; background: var(--dt-creme-2); }
.dt-inter:disabled .dt-inter-piste { border-style: dashed; }
.dt-inter[aria-checked="true"] .dt-inter-piste { background: var(--dt-succes); border-color: var(--dt-succes); }
.dt-inter[aria-checked="true"] .dt-inter-piste::after { left: 1.3em; background: var(--dt-expresso); }
.dt-reglage { display: grid; gap: 0.3em; padding: 0.6em 0; border-bottom: 1px solid var(--dt-filet); }
.dt-reglage > .dt-inter { justify-self: start; }
.dt-curseur { display: flex; align-items: center; gap: 0.6em; }
.dt-curseur input { accent-color: var(--dt-or); flex: 1; min-width: 0; }
.dt-curseur output { min-width: 3em; text-align: right; font-weight: 700; }
.dt-confirmer { position: absolute; inset: 0; z-index: 4; display: grid; align-items: center; padding: 1em; background: rgba(18, 12, 8, 0.6); }
.dt-confirmer .dt-carte { border: 2px solid var(--dt-creme-2); background: var(--dt-expresso); }
.dt-actions { display: grid; gap: 0.45em; margin-top: 0.6em; }
.dt-fil { display: grid; gap: 0.6em; }
.dt-bulle { max-width: 88%; padding: 0.55em 0.75em; border-radius: 0.9em; font-size: 0.9375em; }
.dt-bulle.nouvelle { justify-self: center; max-width: 100%; text-align: center; color: var(--dt-creme-2); font-size: 0.875em; padding: 0.2em 0.4em; }
.dt-bulle.elle { background: #4A3A30; border-bottom-left-radius: 0.25em; }
.dt-qui { display: flex; gap: 0.4em; align-items: center; font-weight: 700; font-size: 0.875em; }
.dt-proposition { border: 2px solid var(--dt-or); background: var(--dt-expresso-2); border-radius: 0.9em; padding: 0.8em 0.85em; display: grid; gap: 0.3em; }
.dt-proposition h3 { font: 600 1.1em/1.2 var(--dt-titre); }
.dt-montant { font-size: 1.05em; font-weight: 700; }
.dt-banniere { position: absolute; left: 0.6em; right: 0.6em; top: 2.6em; z-index: 3; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.1em 0.6em; align-items: center; padding: 0.6em 0.75em; border-radius: 0.9em; background: var(--dt-creme); color: var(--dt-expresso) !important; border: 2px solid var(--dt-expresso); box-shadow: 0 0.5em 1em rgba(0,0,0,0.45); cursor: pointer; text-align: left; }
.dt-banniere b { grid-column: 2; font-size: 0.95em; }
.dt-banniere span:not(.dt-app-dot) { grid-column: 2; font-size: 0.875em; }
.dt-banniere .dt-app-dot { grid-column: 1; grid-row: 1 / span 2; }
.dt-tel-aide { position: absolute; right: calc(100% + 1.6rem); bottom: 0; width: 15.5em; font-size: calc(0.875rem * var(--dt-scale)); display: grid; gap: 0.35em; }
.dt-sans-aide .dt-tel-aide, .dt-hud .dt-sous-tel { display: none !important; }
.dt-tel-aide p { display: flex; gap: 0.3em; align-items: center; flex-wrap: wrap; }
/* Notification du téléphone rangé: deux petites secousses, aucune avec « Réduire les animations ». */
.dt-phone-alert { align-items: center; }
.dt-phone-alert .dt-icon { color: var(--dt-or); }
.dt-screen-proposal { width: 100%; margin: 0 0 0.8em; text-align: left; font: inherit; color: var(--dt-creme); border: 2px solid var(--dt-or); cursor: pointer; }
.dt-buzz { animation: dt-buzz 0.18s steps(2) 4; }
@keyframes dt-buzz { 0% { transform: rotate(-1.2deg); } 100% { transform: rotate(1.2deg); } }
.dt-reduced .dt-buzz { animation: none; }

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
