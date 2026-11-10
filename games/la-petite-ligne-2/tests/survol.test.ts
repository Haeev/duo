// Survol à la souris: le focus du clavier ne suit que les vrais déplacements. Un survol rejoué par
// Chromium (carnet qui monte sous une souris immobile) mettait le focus sur la case 5 vide, et
// manger, poser ou donner la pomme de la case 1 ne faisait plus rien (recette P13 à P15).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { onPointerHover, pointerMoved } from '../src/interface/dom';

const INTERFACE = join(__dirname, '../src/interface');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('survol à la souris', () => {
  it('un survol rejoué sous une souris immobile ne prend pas le focus; un vrai mouvement, si', () => {
    const listeners: ((event: MouseEvent) => void)[] = [];
    const node = {
      addEventListener: (type: string, listener: (event: MouseEvent) => void): void => {
        expect(type).toBe('mousemove');
        listeners.push(listener);
      },
    } as unknown as Pick<HTMLElement, 'addEventListener'>;
    let hovers = 0;
    onPointerHover(node, () => {
      hovers += 1;
    });
    const fire = (movementX: number, movementY: number): void => {
      for (const listener of listeners) listener({ movementX, movementY } as MouseEvent);
    };
    fire(0, 0);
    expect(hovers, 'contenu passé sous la souris').toBe(0);
    fire(3, -1);
    expect(hovers, 'souris déplacée').toBe(1);
    expect(pointerMoved({ movementX: 0, movementY: 2 })).toBe(true);
  });

  it('aucun écran ne donne le focus sur `mouseenter` ou `mouseover` (passer par onPointerHover)', () => {
    const offenders = sources(INTERFACE).filter((file) =>
      /addEventListener\(\s*'mouse(enter|over)'/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
