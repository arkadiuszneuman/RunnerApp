import type { Command } from './commands';

const STX = 2;
const ETX = 3;

/** XOR of bytes[1..n-1]. Byte 0 (the STX) is excluded — matches the device's checksum convention. */
export function checksum(payload: readonly number[]): number {
  let cs = 0;
  for (let i = 1; i < payload.length; i++) {
    cs ^= payload[i];
  }
  return cs;
}

/** `[...payload, checksum(payload), ETX]` */
export function encodeFrame(payload: readonly number[]): Uint8Array {
  return new Uint8Array([...payload, checksum(payload), ETX]);
}

/** A well-formed frame: starts with STX, ends with ETX, non-empty. */
export function isFramed(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes[0] === STX && bytes[bytes.length - 1] === ETX;
}

/**
 * Does `result` echo `command`? Compares the first N bytes, where N is 3 for the
 * start command (its reply doesn't echo the full 8-byte payload) and
 * `command.payload.length` otherwise.
 */
export function isCommandResult(command: Command, result: Uint8Array): boolean {
  const compareLength = command.kind === 'start' ? 3 : command.payload.length;
  for (let i = 0; i < compareLength; i++) {
    if (i >= result.length) return false;
    if (command.payload[i] !== result[i]) return false;
  }
  return true;
}
