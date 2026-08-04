import { encodeFrame } from './frame';
import type { BleTransport } from './transport';

/** Records every frame written and lets tests push notification payloads back. */
export class RecordingTransport implements BleTransport {
  readonly written: Uint8Array[] = [];
  private connected = false;
  private notifyListeners: ((data: Uint8Array) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async write(data: Uint8Array): Promise<void> {
    this.written.push(data);
  }

  onNotify(cb: (data: Uint8Array) => void): () => void {
    this.notifyListeners.push(cb);
    return () => {
      this.notifyListeners = this.notifyListeners.filter((listener) => listener !== cb);
    };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((listener) => listener !== cb);
    };
  }

  /** Test helper: simulate a notification arriving from the device. */
  notify(bytes: Uint8Array): void {
    this.notifyListeners.forEach((cb) => cb(bytes));
  }

  /** Test helper: simulate the GATT link dropping. */
  dropLink(): void {
    this.connected = false;
    this.disconnectListeners.forEach((cb) => cb());
  }
}

export interface FakeTreadmillOptions {
  /** km/h the belt accelerates/decelerates per processed command. */
  rampRate?: number;
}

/**
 * A behavioral simulator: parses incoming frames, tracks belt state, and answers
 * STATUS with a realistic reply whose speed ramps toward the last commanded
 * speed. Used both for RunSession-level tests and as a dev-mode transport so the
 * whole app can be exercised without a treadmill in the room.
 */
export class FakeTreadmill implements BleTransport {
  private readonly rampRate: number;
  private connected = false;
  private running = false;
  private commandedSpeed = 0;
  private commandedIncline = 0;
  private actualSpeed = 0;
  private actualIncline = 0;
  private notifyListeners: ((data: Uint8Array) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  constructor(opts: FakeTreadmillOptions = {}) {
    this.rampRate = opts.rampRate ?? 0.2;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  onNotify(cb: (data: Uint8Array) => void): () => void {
    this.notifyListeners.push(cb);
    return () => {
      this.notifyListeners = this.notifyListeners.filter((listener) => listener !== cb);
    };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((listener) => listener !== cb);
    };
  }

  async write(data: Uint8Array): Promise<void> {
    this.advanceBelt();
    this.handleIncoming(data);
  }

  /**
   * Simulate the user pressing the treadmill's own speed buttons. Also moves the
   * "commanded" speed to match, so the belt holds at `kmh` instead of the ramp
   * immediately correcting it back — matching a real console override, which
   * sticks until the app sends a new speed command.
   */
  manualSpeed(kmh: number): void {
    this.actualSpeed = kmh;
    this.commandedSpeed = kmh;
  }

  /** Simulate the physical link dropping (power loss, out of range, ...). */
  dropLink(): void {
    this.connected = false;
    this.disconnectListeners.forEach((cb) => cb());
  }

  private advanceBelt(): void {
    if (!this.running) return;
    if (this.actualSpeed < this.commandedSpeed) {
      this.actualSpeed = Math.min(this.commandedSpeed, this.actualSpeed + this.rampRate);
    } else if (this.actualSpeed > this.commandedSpeed) {
      this.actualSpeed = Math.max(this.commandedSpeed, this.actualSpeed - this.rampRate);
    }
    this.actualIncline = this.commandedIncline;
  }

  private handleIncoming(data: Uint8Array): void {
    if (data[1] === 81) {
      this.reply(this.statusFrame());
    } else if (data[1] === 83 && data[2] === 1) {
      this.running = true;
      this.actualSpeed = Math.max(this.actualSpeed, 1);
      this.reply(encodeFrame([2, 83, 1]));
    } else if (data[1] === 83 && data[2] === 3) {
      this.running = false;
      this.actualSpeed = 0;
      this.actualIncline = 0;
      this.reply(encodeFrame([2, 83, 3]));
    } else if (data[1] === 83 && data[2] === 2) {
      this.commandedSpeed = data[3] / 10;
      this.commandedIncline = data[4];
      this.reply(encodeFrame([2, 83, 2, data[3], data[4]]));
    } else if (data[1] === 80 && data[2] === 2) {
      this.reply(encodeFrame([2, 80, 2, 18, 1, 1]));
    } else {
      // inclineInfo / totalInfo — just echo the payload, nothing reads the reply
      this.reply(encodeFrame(Array.from(data.subarray(0, data.length - 2))));
    }
  }

  /** [2, 81, 0, 81, 3] when stopped; a 17-byte frame with live speed/incline when running. */
  private statusFrame(): Uint8Array {
    if (!this.running) {
      return new Uint8Array([2, 81, 0, 81, 3]);
    }
    const frame = new Uint8Array(17);
    frame[0] = 2;
    frame[1] = 81;
    frame[3] = Math.round(this.actualSpeed * 10);
    frame[4] = this.actualIncline;
    frame[16] = 3;
    return frame;
  }

  private reply(frame: Uint8Array): void {
    this.notifyListeners.forEach((cb) => cb(frame));
  }
}
