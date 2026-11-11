/**
 * La touche d'action ne rebondit pas: après la fermeture d'un écran, elle n'agit qu'une fois
 * relâchée et le délai (temps réel) écoulé; le déplacement n'est jamais avalé.
 */
import { describe, expect, it } from 'vitest';
import { createControls } from '../src/entrees/commandes';
import type { GameAction } from '../src/actions';
import type { GameView } from '../src/session';

function setup(): {
  step: () => { moveX: number; moveY: number; act: boolean };
  sent: string[];
  down: Set<string>;
  pressed: Set<string>;
  state: { captured: boolean; time: number };
} {
  const down = new Set<string>();
  const pressed = new Set<string>();
  const sent: string[] = [];
  const state = { captured: false, time: 0 };
  const view = {
    world: () => null,
    localIndex: () => null,
    send: (intent: { type: string }) => sent.push(intent.type),
  } as unknown as GameView;
  const controls = createControls({
    input: {
      isDown: (action: GameAction) => down.has(action),
      wasPressed: (action: GameAction) => {
        const was = pressed.has(action);
        pressed.delete(action);
        return was;
      },
      pointer: { right: false, movementX: 0, wheel: 0 },
    } as never,
    view,
    captured: () => state.captured,
    now: () => state.time,
    tuning: { actReleaseGuardMs: 300 },
  });
  return { step: () => controls.step(), sent, down, pressed, state };
}

describe('touche d’action après la fermeture d’un écran', () => {
  it('un appui tardif est avalé, un appui après relâchement et délai passe', () => {
    const t = setup();
    t.state.captured = true;
    t.step();
    t.state.captured = false;
    t.step();
    t.pressed.add('act');
    t.state.time = 100;
    t.step();
    expect(t.sent).toEqual([]);
    t.state.time = 400;
    t.step(); // déverrouillage: touche relâchée, délai passé
    t.pressed.add('act');
    t.step();
    expect(t.sent).toEqual(['act']);
  });

  it('une touche encore tenue après le délai reste verrouillée jusqu’au relâchement', () => {
    const t = setup();
    t.state.captured = true;
    t.down.add('act');
    t.step();
    t.state.captured = false;
    t.state.time = 1000;
    expect(t.step().act).toBe(false);
    t.down.delete('act');
    t.state.time = 1400;
    t.step();
    t.pressed.add('act');
    t.down.add('act');
    expect(t.step().act).toBe(true);
    expect(t.sent).toEqual(['act']);
  });

  it('le déplacement n’est jamais avalé par le verrou de l’action', () => {
    const t = setup();
    t.state.captured = true;
    t.step();
    t.state.captured = false;
    t.step();
    t.down.add('right');
    const out = t.step();
    expect(out.moveX).toBe(1);
  });
});
