/**
 * HUD provisoire en DOM (chantier « interface »): point de visée, invite contextuelle, capsule
 * « Clique pour reprendre la souris », refus. Textes de ux.md; tutoiement. Le bas de l'écran
 * reste libre (mains et plan de travail, technique 2.3).
 */
export interface HudState {
  /** Une cible est visée: anneau au lieu du point. */
  readonly aiming: boolean;
  /** Invite: touche et texte (« E », « Prendre : Tasse »), `null` sans cible. */
  readonly prompt: {
    readonly key: string;
    readonly text: string;
    readonly refused: boolean;
  } | null;
  /** Avancement d'un maintien, de 0 à 1, `null` sans maintien. */
  readonly hold: number | null;
  /** Pointeur libre hors panneau: la capsule s'affiche. */
  readonly capsule: boolean;
}

export interface Hud {
  update(state: HudState): void;
  /** Refus ou message bref, au centre, deux secondes. */
  flash(text: string): void;
  /** Erreur fatale de chargement, lisible par le joueur. */
  fail(text: string): void;
  dispose(): void;
}

const CSS = `
.dt-hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; color: #fffaf0; }
.dt-dot { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #fffaf0; box-shadow: 0 0 2px #000; }
.dt-dot.aim { width: 18px; height: 18px; margin: -9px 0 0 -9px; background: transparent; border: 2px solid #fffaf0; }
.dt-prompt { position: absolute; left: 50%; top: calc(50% + 28px); transform: translateX(-50%); font-size: 16px; text-shadow: 0 1px 3px #000; white-space: nowrap; }
.dt-prompt.refused { opacity: 0.8; font-style: italic; }
.dt-key { display: inline-block; min-width: 1.4em; padding: 0 0.3em; margin-right: 0.4em; border: 1px solid #fffaf0; border-radius: 4px; text-align: center; }
.dt-hold { position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; }
.dt-capsule { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 14px 22px; border-radius: 999px; background: rgba(30, 24, 20, 0.82); text-align: center; }
.dt-capsule small { display: block; margin-top: 4px; opacity: 0.85; }
.dt-flash { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); padding: 6px 14px; border: 1px dashed #fffaf0; border-radius: 999px; background: rgba(30, 24, 20, 0.7); }
.dt-fail { position: absolute; inset: 10%; padding: 20px; background: rgba(30, 24, 20, 0.92); white-space: pre-wrap; overflow: auto; pointer-events: auto; }
`;

export function createHud(root: HTMLElement): Hud {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const layer = document.createElement('div');
  layer.className = 'dt-hud';
  const dot = document.createElement('div');
  dot.className = 'dt-dot';
  const prompt = document.createElement('div');
  prompt.className = 'dt-prompt';
  const hold = document.createElement('div');
  hold.className = 'dt-hold';
  const capsule = document.createElement('div');
  capsule.className = 'dt-capsule';
  capsule.innerHTML =
    'Clique pour reprendre la souris<small>ou appuie sur Entrée. Ce clic n’agit pas dans le café.</small>';
  const flash = document.createElement('div');
  flash.className = 'dt-flash';
  flash.hidden = true;
  layer.append(dot, hold, prompt, capsule, flash);
  root.append(layer);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPrompt = '';

  return {
    update(state) {
      dot.classList.toggle('aim', state.aiming);
      dot.hidden = state.capsule;
      capsule.hidden = !state.capsule;
      const text =
        state.prompt === null || state.capsule
          ? ''
          : `${state.prompt.key}|${state.prompt.text}|${String(state.prompt.refused)}`;
      if (text !== lastPrompt) {
        lastPrompt = text;
        prompt.replaceChildren();
        if (state.prompt !== null && !state.capsule) {
          if (!state.prompt.refused) {
            const key = document.createElement('span');
            key.className = 'dt-key';
            key.textContent = state.prompt.key;
            prompt.append(key);
          }
          prompt.append(state.prompt.text);
          prompt.classList.toggle('refused', state.prompt.refused);
        }
      }
      hold.hidden = state.hold === null;
      if (state.hold !== null) {
        const deg = Math.round(state.hold * 360);
        hold.style.background = `conic-gradient(rgba(255,250,240,0.9) ${deg}deg, rgba(255,250,240,0.15) ${deg}deg)`;
      }
    },
    flash(text) {
      flash.textContent = text;
      flash.hidden = false;
      if (flashTimer !== null) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash.hidden = true;
      }, 2000);
    },
    fail(text) {
      const box = document.createElement('div');
      box.className = 'dt-fail';
      box.textContent = text;
      layer.append(box);
    },
    dispose() {
      if (flashTimer !== null) clearTimeout(flashTimer);
      layer.remove();
      style.remove();
    },
  };
}
