import {
  type Command,
  INCLINE_INFO_COMMAND,
  SPEED_INFO_COMMAND,
  START_COMMAND,
  STATUS_COMMAND,
  STOP_COMMAND,
  TOTAL_INFO_COMMAND,
  incSpeedCommand,
} from './commands';
import { encodeFrame, isCommandResult, isFramed } from './frame';
import type { BleTransport } from './transport';
import type { RunState, TreadmillEvent } from './events';

export interface TreadmillProtocolOptions {
  transport: BleTransport;
  /** Consecutive malformed/mismatched replies tolerated before giving up on the outstanding message. */
  maxRetries?: number;
  logger?: (message: string) => void;
}

const EMPTY_STATE: RunState = { status: '', currentSpeed: 0, currentIncline: 0 };

/**
 * Transport-agnostic treadmill wire protocol: framing, the message queue/retry
 * pump, and the status state machine. Owns no timer and no device discovery —
 * `tick()` must be driven by the host (a 200ms interval on web, a
 * notification-driven pump in the background on mobile — see useRunningLoop.ts
 * and the background-execution design for the React Native port).
 */
export class TreadmillProtocol {
  private readonly transport: BleTransport;
  private readonly maxRetries: number;
  private readonly logger: (message: string) => void;

  private listeners: ((data: TreadmillEvent) => void)[] = [];
  private connected = false;
  private _isRunning = false;
  private _state: RunState = EMPTY_STATE;
  private lastMessage: Command | undefined;
  private messageQueue: Command[] = [];
  private retries: number;
  private unsubscribeNotify: (() => void) | undefined;
  private unsubscribeDisconnect: (() => void) | undefined;

  constructor(opts: TreadmillProtocolOptions) {
    this.transport = opts.transport;
    this.maxRetries = opts.maxRetries ?? 5;
    this.retries = this.maxRetries;
    this.logger = opts.logger ?? (() => {});
  }

  /** Subscribe to the transport, reset state, enqueue the initial info commands. Emits btConnected. */
  async attach(): Promise<void> {
    this.detach();
    this._isRunning = false;
    this._state = EMPTY_STATE;
    this.lastMessage = undefined;
    this.messageQueue = [];
    this.retries = this.maxRetries;

    this.unsubscribeNotify = this.transport.onNotify((data) => this.handleNotification(data));
    this.unsubscribeDisconnect = this.transport.onDisconnect(() => this.handleDisconnect());

    this.enqueue(SPEED_INFO_COMMAND);
    this.enqueue(INCLINE_INFO_COMMAND);
    this.enqueue(TOTAL_INFO_COMMAND);

    this.connected = true;
    this.emit({ type: 'btConnected' });
  }

  /** Unsubscribe from the transport and reset state. Does NOT disconnect the transport itself. */
  detach(): void {
    this.unsubscribeNotify?.();
    this.unsubscribeDisconnect?.();
    this.unsubscribeNotify = undefined;
    this.unsubscribeDisconnect = undefined;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  get state(): Readonly<RunState> {
    return this._state;
  }

  /**
   * One step of the message pump: resend the outstanding message, or shift the
   * next one off the queue (sent on the *next* tick — matches the original
   * device firmware's cadence), or poll STATUS if idle. Call this every ~200ms.
   * Idempotent and cheap; safe to over-call.
   */
  tick(): void {
    if (this.lastMessage) {
      this.write(this.lastMessage);
    } else if (this.messageQueue.length > 0) {
      this.lastMessage = this.messageQueue.shift();
    } else {
      this.enqueue(STATUS_COMMAND);
    }
  }

  enqueue(command: Command): void {
    this.messageQueue.push(command);
  }

  /** Bypasses the queue and writes immediately. */
  async start(): Promise<void> {
    await this.write(START_COMMAND);
  }

  /** Bypasses the queue and writes immediately. */
  async stop(): Promise<void> {
    await this.write(STOP_COMMAND);
  }

  /**
   * No-op unless the treadmill is running. `-1` for either argument keeps the
   * current value. Enqueues the same frame twice — a workaround for the device
   * occasionally dropping the first copy.
   */
  sendIncAndSpeed(incline: number, speed: number): void {
    if (!this.isRunning()) return;
    const newSpeed = speed === -1 ? this._state.currentSpeed : speed;
    const newIncline = incline === -1 ? this._state.currentIncline : incline;
    const command = incSpeedCommand(newSpeed, newIncline);
    this.enqueue(command);
    this.enqueue(command);
  }

  subscribe(cb: (data: TreadmillEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== cb);
    };
  }

  private emit(data: TreadmillEvent): void {
    this.listeners.forEach((cb) => cb(data));
  }

  private write(command: Command): Promise<void> {
    const frame = encodeFrame(command.payload);
    return this.transport.write(frame).catch(() => {
      this.connected = false;
      this.emit({ type: 'btDisconnected' });
    });
  }

  private handleDisconnect(): void {
    this.connected = false;
    this._isRunning = false;
    this.emit({ type: 'btDisconnected' });
  }

  private handleNotification(data: Uint8Array): void {
    const prevStatus = this._state.status;
    const valueLength = data.length;

    if (!this.lastMessage || !isFramed(data) || !isCommandResult(this.lastMessage, data)) {
      this.logger('invalid response');
      this.retries--;
      if (this.retries <= 0) {
        this.lastMessage = undefined;
        this.retries = this.maxRetries;
      }
      return;
    }

    switch (this.lastMessage.kind) {
      case 'speedInfo': {
        const maxSpeed = data[3];
        const minSpeed = data[4];
        const unitSpeed = data[5];
        this.emit({ type: 'btSpeedInfo', state: { maxSpeed, minSpeed, unitSpeed } });
        break;
      }
      case 'status': {
        if (valueLength === 5 && data[2] === 0 && data[3] === 81) {
          this._isRunning = false;
          this._state = { status: 'Stopped', currentSpeed: 0, currentIncline: 0 };
          if (prevStatus !== this._state.status) {
            this.emit({ type: 'btStopped', state: this._state });
          }
        } else if (valueLength > 5 && valueLength < 17) {
          this._state = { status: 'Starting', currentSpeed: 0, currentIncline: 0 };
          if (prevStatus !== this._state.status) {
            this.emit({ type: 'btStarting', state: this._state });
          }
        } else if (valueLength === 17) {
          this._isRunning = true;
          this._state = {
            status: 'Running',
            currentSpeed: data[3] / 10,
            currentIncline: data[4],
          };
          this.emit({ type: 'btRunning', state: this._state });
        }
        break;
      }
      // 'inclineInfo' | 'totalInfo': reply validated and cleared, nothing emitted
      // (the original firmware handlers for these were never implemented either).
      // 'incSpeed': the echo only needs to clear lastMessage below — it must NOT
      // be interpreted as a status frame. Previously this fell out by accident
      // (identity comparison against a module-singleton command array that
      // sendIncAndSpeed's freshly-built array could never match); now it's explicit.
      default:
        break;
    }

    this.lastMessage = undefined;
  }
}
