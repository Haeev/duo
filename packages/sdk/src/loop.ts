// Module `loop`: simulation à pas fixe et rendu interpolé (ADR 0005, point 4).
// Les pas avancent à chaque image quand la page est visible, et par un minuteur quand elle ne
// l'est pas (fenêtre réduite): l'hôte garde ses 60 pas par seconde (ADR 0004).
import type { Loop, LoopOptions } from './api';
import { createFixedStepper, type FixedStepper } from './stepper';

export interface LoopHooks {
  /** Vrai pendant la pause de la plateforme: les pas s'arrêtent, le rendu continue. */
  isPaused(): boolean;
  /** Fin de chaque pas (consommation des appuis). */
  afterStep(): void;
  /** Juste après le rendu de chaque image, dans la même tâche (lecture du canevas WebGL). */
  afterRender?(): void;
}

export interface PerfSample {
  readonly fps: number;
  readonly frameMs: number;
  readonly stepHz: number;
}

export interface LoopInternal extends Loop {
  /** Mesures depuis l'appel précédent, envoyées chaque seconde à la plateforme. */
  takePerfSample(): PerfSample;
  dispose(): void;
}

export function createLoop(hooks: LoopHooks): LoopInternal {
  let stepper: FixedStepper | null = null;
  let options: LoopOptions | null = null;
  let tick = 0;
  let last = 0;
  let lastFrame = 0;
  let rafId = 0;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let frames = 0;
  let frameTimeSum = 0;
  let steps = 0;
  let sampleStart = performance.now();
  // Objets réutilisés à chaque pas et à chaque image: aucune allocation dans la boucle.
  const stepInfo = { tick: 0, dt: 0 };
  // Sans requestAnimationFrame (Node), seul le minuteur fait avancer la simulation.
  const hasRaf = typeof requestAnimationFrame === 'function';
  const frameInfo = { alpha: 0, dt: 0 };

  const pump = (): void => {
    if (stepper === null || options === null) return;
    const now = performance.now();
    const elapsed = now - last;
    last = now;
    if (hooks.isPaused()) {
      stepper.reset();
      return;
    }
    const count = stepper.advance(elapsed);
    for (let i = 0; i < count; i++) {
      stepInfo.tick = tick;
      options.step(stepInfo);
      tick++;
      steps++;
      hooks.afterStep();
    }
  };

  const onTimer = (): void => {
    pump();
    if (stepper !== null) timerId = setTimeout(onTimer, stepper.stepMs);
  };

  const onFrame = (time: number): void => {
    if (stepper === null || options === null) return;
    pump();
    const dt = lastFrame === 0 ? 0 : (time - lastFrame) / 1000;
    lastFrame = time;
    frames++;
    frameTimeSum += dt * 1000;
    if (options.render !== undefined) {
      frameInfo.alpha = stepper.alpha();
      frameInfo.dt = dt;
      options.render(frameInfo);
      hooks.afterRender?.();
    }
    rafId = requestAnimationFrame(onFrame);
  };

  const stop = (): void => {
    stepper = null;
    options = null;
    if (hasRaf) cancelAnimationFrame(rafId);
    if (timerId !== undefined) clearTimeout(timerId);
    timerId = undefined;
  };

  return {
    start(next) {
      stop();
      const hz = next.hz ?? 60;
      stepper = createFixedStepper(hz);
      options = next;
      stepInfo.dt = 1 / hz;
      last = performance.now();
      lastFrame = 0;
      timerId = setTimeout(onTimer, stepper.stepMs);
      if (hasRaf) rafId = requestAnimationFrame(onFrame);
    },
    stop,
    get running() {
      return stepper !== null;
    },
    get tick() {
      return tick;
    },
    takePerfSample() {
      const now = performance.now();
      const seconds = Math.max(0.001, (now - sampleStart) / 1000);
      const sample = {
        fps: frames / seconds,
        frameMs: frames > 0 ? frameTimeSum / frames : 0,
        stepHz: steps / seconds,
      };
      frames = 0;
      frameTimeSum = 0;
      steps = 0;
      sampleStart = now;
      return sample;
    },
    dispose: stop,
  };
}
