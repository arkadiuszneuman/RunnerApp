import { describe, expect, it } from 'vitest';
import { checksum, encodeFrame, isCommandResult, isFramed } from './frame';
import { START_COMMAND, STATUS_COMMAND, incSpeedCommand } from './commands';

describe('checksum', () => {
  it('XORs bytes[1..] and skips the leading STX', () => {
    expect(checksum([2, 81])).toBe(81);
  });
});

describe('encodeFrame', () => {
  it('appends checksum and ETX', () => {
    expect(Array.from(encodeFrame([2, 81]))).toStrictEqual([2, 81, 81, 3]);
    expect(Array.from(encodeFrame([2, 80, 2]))).toStrictEqual([2, 80, 2, 82, 3]);
    expect(Array.from(encodeFrame([2, 83, 3]))).toStrictEqual([2, 83, 3, 80, 3]);
  });

  it('handles a checksum that coincidentally equals the ETX terminator', () => {
    expect(Array.from(encodeFrame(incSpeedCommand(8, 2).payload))).toStrictEqual([
      2, 83, 2, 80, 2, 3, 3,
    ]);
  });

  it('matches the 8-byte start command payload', () => {
    expect(Array.from(encodeFrame(START_COMMAND.payload))).toStrictEqual([
      2, 83, 1, 0, 0, 0, 0, 0, 82, 3,
    ]);
  });
});

describe('isFramed', () => {
  it('rejects an empty buffer', () => {
    expect(isFramed(new Uint8Array([]))).toBe(false);
  });

  it('rejects a buffer with the wrong leading byte', () => {
    expect(isFramed(new Uint8Array([1, 81, 81, 3]))).toBe(false);
  });

  it('rejects a buffer with the wrong trailing byte', () => {
    expect(isFramed(new Uint8Array([2, 81, 81, 4]))).toBe(false);
  });

  it('accepts a well-formed frame', () => {
    expect(isFramed(encodeFrame([2, 81]))).toBe(true);
  });
});

describe('isCommandResult', () => {
  it('matches an exact echo', () => {
    expect(isCommandResult(STATUS_COMMAND, new Uint8Array([2, 81, 0, 81, 3]))).toBe(true);
  });

  it('rejects a truncated result', () => {
    expect(isCommandResult(STATUS_COMMAND, new Uint8Array([2]))).toBe(false);
  });

  it('rejects a byte mismatch', () => {
    expect(isCommandResult(STATUS_COMMAND, new Uint8Array([2, 99, 0, 81, 3]))).toBe(false);
  });

  it('compares only the first 3 bytes for the start command', () => {
    expect(isCommandResult(START_COMMAND, new Uint8Array([2, 83, 1, 255, 255, 255]))).toBe(true);
  });
});
