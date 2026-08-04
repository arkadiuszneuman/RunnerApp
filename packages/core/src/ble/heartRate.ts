import type { BleTransport } from './transport';

/**
 * Parses a standard BLE Heart Rate Measurement (0x2A37) payload.
 * Flags byte bit 0 selects 8-bit vs 16-bit BPM encoding (little-endian).
 * Returns undefined for a payload too short to contain a BPM value.
 */
export function parseHeartRateMeasurement(bytes: Uint8Array): number | undefined {
  if (bytes.length < 2) return undefined;
  const is16Bit = (bytes[0] & 0x01) !== 0;
  if (is16Bit) {
    if (bytes.length < 3) return undefined;
    return bytes[1] | (bytes[2] << 8);
  }
  return bytes[1];
}

export interface HeartRateMonitorOptions {
  transport: BleTransport;
}

export class HeartRateMonitor {
  private readonly transport: BleTransport;
  private listeners: ((bpm: number) => void)[] = [];
  private unsubscribeNotify: (() => void) | undefined;
  private unsubscribeDisconnect: (() => void) | undefined;

  constructor(opts: HeartRateMonitorOptions) {
    this.transport = opts.transport;
  }

  /**
   * Subscribe to notifications. On a link drop, reconnects via the transport
   * (whose `connect()` contract re-arms notifications) rather than resubscribing
   * here — this is what keeps a 16-bit-format sensor's readings flowing after a
   * reconnect, instead of them silently stopping.
   */
  async attach(): Promise<void> {
    this.detach();
    this.unsubscribeNotify = this.transport.onNotify((data) => {
      const bpm = parseHeartRateMeasurement(data);
      if (bpm !== undefined) this.emit(bpm);
    });
    this.unsubscribeDisconnect = this.transport.onDisconnect(() => {
      this.transport.connect().catch(() => {});
    });
  }

  detach(): void {
    this.unsubscribeNotify?.();
    this.unsubscribeDisconnect?.();
    this.unsubscribeNotify = undefined;
    this.unsubscribeDisconnect = undefined;
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  subscribe(cb: (bpm: number) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== cb);
    };
  }

  private emit(bpm: number): void {
    this.listeners.forEach((cb) => cb(bpm));
  }
}
