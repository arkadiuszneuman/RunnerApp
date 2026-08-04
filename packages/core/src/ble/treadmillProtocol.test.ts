import { describe, expect, it } from 'vitest';
import { TreadmillProtocol } from './treadmillProtocol';
import { RecordingTransport } from './fakeTreadmill';
import { encodeFrame } from './frame';
import { INCLINE_INFO_COMMAND, SPEED_INFO_COMMAND, STATUS_COMMAND, TOTAL_INFO_COMMAND } from './commands';
import type { TreadmillEvent } from './events';

/**
 * Ticks until a newly-written frame matches `predicate`, without acking it —
 * so the caller can then `transport.notify(...)` a specific fixture while it's
 * still the outstanding message. Any write that doesn't match is acked with its
 * own bytes (always a valid generic ack — see isCommandResult) so the queue
 * keeps advancing.
 */
function tickUntilWritten(
  protocol: TreadmillProtocol,
  transport: RecordingTransport,
  predicate: (frame: Uint8Array) => boolean,
  maxTicks = 30
): Uint8Array {
  for (let i = 0; i < maxTicks; i++) {
    const before = transport.written.length;
    protocol.tick();
    if (transport.written.length > before) {
      const frame = transport.written[transport.written.length - 1];
      if (predicate(frame)) return frame;
      transport.notify(frame);
    }
  }
  throw new Error('predicate never matched within maxTicks');
}

const isStatusWrite = (frame: Uint8Array) => frame[1] === 81;

function collectEvents(protocol: TreadmillProtocol): TreadmillEvent[] {
  const events: TreadmillEvent[] = [];
  protocol.subscribe((e) => events.push(e));
  return events;
}

describe('TreadmillProtocol', () => {
  it('writes the initial info commands in order, one write per (shift tick, write tick) pair', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();

    protocol.tick(); // shifts SPEED_INFO_COMMAND into lastMessage — no write yet
    expect(transport.written).toHaveLength(0);
    protocol.tick(); // writes it
    expect(Array.from(transport.written[0])).toStrictEqual(
      Array.from(encodeFrame(SPEED_INFO_COMMAND.payload))
    );
    transport.notify(encodeFrame([2, 80, 2, 18, 1, 1]));

    protocol.tick(); // shifts INCLINE_INFO_COMMAND
    protocol.tick(); // writes it
    expect(Array.from(transport.written[1])).toStrictEqual(
      Array.from(encodeFrame(INCLINE_INFO_COMMAND.payload))
    );
    transport.notify(transport.written[1]);

    protocol.tick(); // shifts TOTAL_INFO_COMMAND
    protocol.tick(); // writes it
    expect(Array.from(transport.written[2])).toStrictEqual(
      Array.from(encodeFrame(TOTAL_INFO_COMMAND.payload))
    );

    expect(transport.written).toHaveLength(3);
  });

  it('polls STATUS once the queue is idle', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();

    const frame = tickUntilWritten(protocol, transport, isStatusWrite);
    expect(Array.from(frame)).toStrictEqual(Array.from(encodeFrame(STATUS_COMMAND.payload)));
  });

  it('resends the outstanding message every tick until an echo arrives', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();

    tickUntilWritten(protocol, transport, isStatusWrite);
    const countAfterFirstWrite = transport.written.length;

    protocol.tick(); // no ack yet — must resend the same STATUS command
    protocol.tick();
    expect(transport.written.length).toBe(countAfterFirstWrite + 2);
    const lastFrame = transport.written[transport.written.length - 1];
    expect(Array.from(lastFrame)).toStrictEqual(Array.from(encodeFrame(STATUS_COMMAND.payload)));

    transport.notify(lastFrame);
    const countAfterAck = transport.written.length;
    protocol.tick(); // shifts the next STATUS poll — no write yet
    expect(transport.written.length).toBe(countAfterAck);
  });

  it('emits btStopped once for a Stopped status frame, then nothing for a repeat', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    const events = collectEvents(protocol);

    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(new Uint8Array([2, 81, 0, 81, 3]));
    expect(events.filter((e) => e.type === 'btStopped')).toHaveLength(1);

    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(new Uint8Array([2, 81, 0, 81, 3]));
    expect(events.filter((e) => e.type === 'btStopped')).toHaveLength(1);
  });

  it('emits btStarting for a mid-length status frame', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    const events = collectEvents(protocol);

    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(new Uint8Array([2, 81, 0, 0, 0, 0, 0, 0, 0, 3])); // length 10
    expect(events.filter((e) => e.type === 'btStarting')).toHaveLength(1);
  });

  it('emits btRunning with decoded speed/incline on every 17-byte status frame', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    const events = collectEvents(protocol);

    const runningFrame = new Uint8Array(17);
    runningFrame[0] = 2;
    runningFrame[1] = 81;
    runningFrame[3] = 75; // 7.5 km/h
    runningFrame[4] = 3; // incline 3
    runningFrame[16] = 3;

    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(runningFrame);
    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(runningFrame);

    const runningEvents = events.filter((e) => e.type === 'btRunning');
    expect(runningEvents).toHaveLength(2);
    expect(runningEvents[0]).toStrictEqual({
      type: 'btRunning',
      state: { status: 'Running', currentSpeed: 7.5, currentIncline: 3 },
    });
    expect(protocol.isRunning()).toBe(true);
  });

  it('emits btSpeedInfo for the speedInfo reply', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    const events = collectEvents(protocol);

    protocol.tick();
    protocol.tick(); // writes SPEED_INFO_COMMAND
    transport.notify(encodeFrame([2, 80, 2, 18, 1, 1]));

    expect(events).toContainEqual({
      type: 'btSpeedInfo',
      state: { maxSpeed: 18, minSpeed: 1, unitSpeed: 1 },
    });
  });

  it('decrements retries on a garbage reply and gives up on the outstanding message after maxRetries', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport, maxRetries: 2 });
    await protocol.attach();

    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(new Uint8Array([9, 9, 9])); // malformed — not even framed
    transport.notify(new Uint8Array([9, 9, 9])); // 2nd bad reply hits maxRetries

    // lastMessage was dropped, so tick() should now shift a fresh STATUS poll
    // rather than resending the abandoned one.
    const before = transport.written.length;
    protocol.tick(); // enqueue STATUS
    protocol.tick(); // shift it — no write yet, proving lastMessage was cleared
    expect(transport.written.length).toBe(before);
  });

  it("sendIncAndSpeed is a no-op while stopped", async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();

    protocol.sendIncAndSpeed(2, 8);
    expect(transport.written).toHaveLength(0);
  });

  it('sendIncAndSpeed enqueues the same frame twice while running', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();

    const runningFrame = new Uint8Array(17);
    runningFrame[0] = 2;
    runningFrame[1] = 81;
    runningFrame[3] = 40;
    runningFrame[4] = 2;
    runningFrame[16] = 3;
    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(runningFrame);
    expect(protocol.isRunning()).toBe(true);

    transport.written.length = 0;
    protocol.sendIncAndSpeed(2, 8);

    const first = tickUntilWritten(protocol, transport, (f) => f[1] === 83 && f[2] === 2);
    transport.notify(first); // ack — must NOT be read as a status frame
    const second = tickUntilWritten(protocol, transport, (f) => f[1] === 83 && f[2] === 2);

    expect(Array.from(first)).toStrictEqual(Array.from(second));
    expect(Array.from(first)).toStrictEqual(Array.from(encodeFrame([2, 83, 2, 80, 2])));
  });

  it('sendIncAndSpeed(-1, -1) keeps the current speed/incline', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();

    const runningFrame = new Uint8Array(17);
    runningFrame[0] = 2;
    runningFrame[1] = 81;
    runningFrame[3] = 40; // 4.0 km/h
    runningFrame[4] = 3;
    runningFrame[16] = 3;
    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(runningFrame);

    transport.written.length = 0;
    protocol.sendIncAndSpeed(-1, -1);

    const frame = tickUntilWritten(protocol, transport, (f) => f[1] === 83 && f[2] === 2);
    expect(Array.from(frame)).toStrictEqual(Array.from(encodeFrame([2, 83, 2, 40, 3])));
  });

  it('an incSpeed echo clears lastMessage without emitting anything', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    const events = collectEvents(protocol);

    const runningFrame = new Uint8Array(17);
    runningFrame[0] = 2;
    runningFrame[1] = 81;
    runningFrame[3] = 40;
    runningFrame[4] = 2;
    runningFrame[16] = 3;
    tickUntilWritten(protocol, transport, isStatusWrite);
    transport.notify(runningFrame);

    events.length = 0;
    protocol.sendIncAndSpeed(2, 8);
    const frame = tickUntilWritten(protocol, transport, (f) => f[1] === 83 && f[2] === 2);
    transport.notify(frame);

    expect(events).toHaveLength(0);
  });

  it('emits btDisconnected and flips isConnected() when the link drops', async () => {
    const transport = new RecordingTransport();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    const events = collectEvents(protocol);

    transport.dropLink();

    expect(protocol.isConnected()).toBe(false);
    expect(events).toContainEqual({ type: 'btDisconnected' });
  });
});
