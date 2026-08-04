/**
 * Platform-agnostic view of one connected GATT characteristic pair.
 * The protocol layer never sees DataView, base64, GATT objects, or device pickers —
 * only raw bytes in and out. Device discovery, permission prompts, and reconnect
 * strategy all live in the platform-specific implementation of this interface.
 *
 * `onNotify` subscriptions are expected to persist across reconnects: if the
 * underlying link drops and `connect()` is called again, previously registered
 * `onNotify` callbacks should keep receiving future notifications without needing
 * to be re-registered. The transport is responsible for re-arming its underlying
 * notification stream inside `connect()`.
 */
export interface BleTransport {
  /** Discover/select the device, connect GATT, start notifications. Idempotent. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  /** Write one complete, already-framed message to the write characteristic. */
  write(data: Uint8Array): Promise<void>;

  /** Every notification payload from the read characteristic. Returns an unsubscribe function. */
  onNotify(cb: (data: Uint8Array) => void): () => void;

  /** The underlying link dropped (GATT disconnect / peripheral gone). Returns an unsubscribe function. */
  onDisconnect(cb: () => void): () => void;
}
