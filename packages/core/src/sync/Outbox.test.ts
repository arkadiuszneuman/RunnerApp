import { describe, expect, it } from 'vitest';
import { Timespan } from '../services/Timespan';
import { Outbox, type OutboxEntry, type OutboxRequest, type OutboxStorage } from './Outbox';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function memoryStorage(initial: OutboxEntry[] = []): OutboxStorage & { data: OutboxEntry[] } {
  const storage = {
    data: clone(initial),
    async load() {
      return clone(storage.data);
    },
    async save(entries: OutboxEntry[]) {
      storage.data = clone(entries);
    },
  };
  return storage;
}

/** A send() whose responses are scripted per call: a status code, or 'offline' to reject. */
function scriptedSend(script: (number | 'offline')[]) {
  const calls: OutboxRequest[] = [];
  let i = 0;
  const send = async (request: OutboxRequest) => {
    calls.push(request);
    const next = script[i++] ?? 200;
    if (next === 'offline') throw new TypeError('Failed to fetch');
    return { status: next };
  };
  return { send, calls };
}

function setup(script: (number | 'offline')[] = [], initial: OutboxEntry[] = []) {
  const storage = memoryStorage(initial);
  const { send, calls } = scriptedSend(script);
  let clock = 1_000;
  let ids = 0;
  const outbox = new Outbox({
    storage,
    send,
    now: () => clock,
    createId: () => `e${++ids}`,
  });
  return {
    outbox,
    storage,
    calls,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('Outbox', () => {
  it('persists enqueued requests and sends them in order', async () => {
    const { outbox, storage, calls } = setup();
    await outbox.enqueue({ method: 'POST', url: '/api/runs', body: { id: 'r1' } }, { key: 'run-create:r1' });
    await outbox.enqueue({ method: 'PATCH', url: '/api/runs/r1', body: { telemetry: [] } }, { key: 'run-patch:r1' });
    expect(storage.data.map((e) => e.key)).toEqual(['run-create:r1', 'run-patch:r1']);

    const result = await outbox.flush();

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['POST /api/runs', 'PATCH /api/runs/r1']);
    expect(result.sent).toHaveLength(2);
    expect(result.blocked).toBeNull();
    expect(storage.data).toEqual([]);
    expect(outbox.entries()).toEqual([]);
  });

  it('coalesces a waiting entry with the same key in place, keeping its queue position', async () => {
    const { outbox, storage } = setup();
    await outbox.enqueue({ method: 'PATCH', url: '/api/runs/r1', body: { telemetry: [1] } }, { key: 'run-patch:r1' });
    await outbox.enqueue({ method: 'DELETE', url: '/api/runs/r2' }, { key: 'run-delete:r2' });
    await outbox.enqueue({ method: 'PATCH', url: '/api/runs/r1', body: { telemetry: [1, 2] } }, { key: 'run-patch:r1' });

    expect(storage.data.map((e) => [e.key, e.body])).toEqual([
      ['run-patch:r1', { telemetry: [1, 2] }],
      ['run-delete:r2', undefined],
    ]);
  });

  it('applies a custom merge when coalescing', async () => {
    const { outbox, storage } = setup();
    const merge = (a: unknown, b: unknown) => ({ ...(a as object), ...(b as object) });
    await outbox.enqueue({ method: 'PATCH', url: '/api/runs/r1', body: { telemetry: [1], finishedAt: 'x' } }, { key: 'k', merge });
    await outbox.enqueue({ method: 'PATCH', url: '/api/runs/r1', body: { telemetry: [1, 2] } }, { key: 'k', merge });

    expect(storage.data[0].body).toEqual({ telemetry: [1, 2], finishedAt: 'x' });
  });

  it('normalizes bodies through JSON so class instances become plain data', async () => {
    const { outbox, storage } = setup();
    await outbox.enqueue(
      { method: 'PUT', url: '/api/programs/p1', body: { duration: Timespan.fromSeconds(90) } },
      { key: 'program-update:p1' }
    );
    expect(storage.data[0].body).toEqual({ duration: { totalMilliseconds: 90_000 } });
  });

  it('stops at a network failure and keeps the entry (and everything after it) for later', async () => {
    const { outbox, storage, calls } = setup(['offline']);
    await outbox.enqueue({ method: 'POST', url: '/a' }, { key: 'a' });
    await outbox.enqueue({ method: 'POST', url: '/b' }, { key: 'b' });

    const result = await outbox.flush();

    expect(result.blocked).toBe('offline');
    expect(calls).toHaveLength(1);
    expect(storage.data.map((e) => [e.key, e.attempts, e.sendingSince])).toEqual([
      ['a', 1, undefined],
      ['b', 0, undefined],
    ]);

    const retry = await outbox.flush();
    expect(retry.blocked).toBeNull();
    expect(storage.data).toEqual([]);
  });

  it.each([
    [401, 'auth'],
    [500, 'server'],
    [503, 'server'],
    [429, 'server'],
  ] as const)('keeps the entry and stops on HTTP %i', async (status, reason) => {
    const { outbox, storage } = setup([status]);
    await outbox.enqueue({ method: 'POST', url: '/a' }, { key: 'a' });

    const result = await outbox.flush();

    expect(result.blocked).toBe(reason);
    expect(storage.data).toHaveLength(1);
  });

  it.each([400, 404, 409])('drops an entry the server permanently rejects (%i) and carries on', async (status) => {
    const { outbox, storage, calls } = setup([status, 200]);
    await outbox.enqueue({ method: 'PUT', url: '/gone' }, { key: 'a' });
    await outbox.enqueue({ method: 'POST', url: '/b' }, { key: 'b' });

    const result = await outbox.flush();

    expect(calls.map((c) => c.url)).toEqual(['/gone', '/b']);
    expect(result.dropped.map((e) => e.key)).toEqual(['a']);
    expect(result.sent.map((e) => e.key)).toEqual(['b']);
    expect(storage.data).toEqual([]);
  });

  it('never coalesces into an entry that is already on the wire', async () => {
    const storage = memoryStorage();
    let release!: () => void;
    const outbox = new Outbox({
      storage,
      send: (request) =>
        new Promise((resolve) => {
          if (request.body && (request.body as { n: number }).n === 1) {
            release = () => resolve({ status: 200 });
          } else {
            resolve({ status: 200 });
          }
        }),
    });
    await outbox.enqueue({ method: 'PATCH', url: '/r', body: { n: 1 } }, { key: 'k' });

    const flushing = outbox.flush();
    await waitFor(() => storage.data[0]?.sendingSince !== undefined);
    await outbox.enqueue({ method: 'PATCH', url: '/r', body: { n: 2 } }, { key: 'k' });
    expect(storage.data.map((e) => e.body)).toEqual([{ n: 1 }, { n: 2 }]);

    release();
    await flushing;
    // The flush that sent n=1 removed only that entry; n=2 is picked up by the same flush loop.
    expect(storage.data).toEqual([]);
  });

  it('does not send an entry another context is currently sending, until that claim goes stale', async () => {
    const claimed: OutboxEntry = {
      id: 'x',
      key: 'k',
      method: 'POST',
      url: '/a',
      enqueuedAt: 0,
      attempts: 0,
      sendingSince: 1_000,
    };
    const { outbox, calls, advance } = setup([], [claimed]);

    expect((await outbox.flush()).blocked).toBe('busy');
    expect(calls).toHaveLength(0);

    advance(60_000);
    expect((await outbox.flush()).blocked).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('shares one run between concurrent flush() calls', async () => {
    const { outbox, calls } = setup();
    await outbox.enqueue({ method: 'POST', url: '/a' }, { key: 'a' });

    const [first, second] = await Promise.all([outbox.flush(), outbox.flush()]);

    expect(calls).toHaveLength(1);
    expect(first).toBe(second);
  });

  it('notifies subscribers when the queue changes', async () => {
    const { outbox } = setup();
    const seen: number[] = [];
    outbox.subscribe((entries) => seen.push(entries.length));

    await outbox.enqueue({ method: 'POST', url: '/a' }, { key: 'a' });
    await outbox.flush();

    // (An extra notification in between marks the entry as being sent.)
    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(0);
  });

  it('refresh() picks up entries written by someone else', async () => {
    const { outbox, storage } = setup();
    storage.data = [{ id: 'z', key: 'k', method: 'DELETE', url: '/z', enqueuedAt: 0, attempts: 0 }];

    await outbox.refresh();

    expect(outbox.entries().map((e) => e.id)).toEqual(['z']);
  });
});

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 1000 && !condition(); i++) {
    await Promise.resolve();
  }
  if (!condition()) throw new Error('condition never became true');
}
