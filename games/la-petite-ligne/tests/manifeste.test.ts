import { parseManifest } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';

describe('manifeste', () => {
  it('respecte le schéma de @duo/protocol (ADR 0005)', () => {
    const result = parseManifest(manifest);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });
});
