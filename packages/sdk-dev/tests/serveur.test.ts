// Relais et stockage du mode réseau local.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDiskStore } from '../src/serveur/disque.ts';
import { createRelay, MAX_RELAY_FRAME_BYTES } from '../src/serveur/relais.ts';

function socket(): { sent: string[]; send: (t: string) => void; close: () => void } {
  const sent: string[] = [];
  return { sent, send: (t) => sent.push(t), close: () => undefined };
}

describe('relais', () => {
  it("relaie chaque trame de l'un chez l'autre et annonce la présence", () => {
    const relay = createRelay();
    const host = socket();
    const guest = socket();
    const h = relay.join('host', host);
    expect(host.sent).toEqual(['{"t":"peer","present":false}']);
    expect(relay.hostPresent()).toBe(true);
    const g = relay.join('guest', guest);
    if (!h.ok || !g.ok) throw new Error('refus inattendu');
    expect(host.sent.at(-1)).toBe('{"t":"peer","present":true}');
    expect(guest.sent).toEqual(['{"t":"peer","present":true}']);

    g.member.onText('{"t":"ready"}');
    h.member.onText('{"t":"start","atSessionMs":1}');
    expect(host.sent.at(-1)).toBe('{"t":"ready"}');
    expect(guest.sent.at(-1)).toBe('{"t":"start","atSessionMs":1}');

    g.member.onText('x'.repeat(MAX_RELAY_FRAME_BYTES + 1));
    expect(host.sent.at(-1)).toBe('{"t":"ready"}');

    g.member.onClose();
    expect(host.sent.at(-1)).toBe('{"t":"peer","present":false}');
  });

  it('refuse un second hôte ou un second invité, et accepte un nouvel invité après un départ', () => {
    const relay = createRelay();
    relay.join('host', socket());
    expect(relay.join('host', socket())).toMatchObject({ ok: false });
    const first = relay.join('guest', socket());
    expect(relay.join('guest', socket())).toMatchObject({ ok: false });
    if (!first.ok) throw new Error('refus inattendu');
    first.member.onClose();
    expect(relay.join('guest', socket())).toMatchObject({ ok: true });
  });
});

describe('stockage sur disque', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  it('écrit, relit, garde la version précédente et se replie dessus si le fichier est abîmé', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'duo-sdk-dev-é ç-'));
    dirs.push(dir);
    const store = createDiskStore(dir);
    expect(await store.list()).toEqual([]);
    const base = {
      slot: 1,
      dataSchema: 1,
      gameVersion: '0.1.0',
      moment: 'level-end',
      savedAt: '2026-10-31T00:00:00Z',
    };
    await store.write({ ...base, label: 'Jour 1', data: '{"jour":1}' });
    await store.write({ ...base, label: 'Jour 2', data: '{"jour":2}', progress: 0.2 });
    expect(await store.read(1)).toMatchObject({ label: 'Jour 2', data: '{"jour":2}' });
    expect(await store.list()).toEqual([{ ...base, label: 'Jour 2', progress: 0.2 }]);

    const file = join(dir, 'sauvegardes', 'emplacement-1.json');
    await writeFile(file, '{ abîmé');
    expect(await store.read(1)).toMatchObject({ label: 'Jour 1' });

    await store.appendHistory({ id: 'p1' });
    await store.appendHistory({ id: 'p2' });
    expect((await readFile(join(dir, 'historique.jsonl'), 'utf8')).trim().split('\n')).toHaveLength(
      2,
    );
  });
});
