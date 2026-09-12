import {
  incSpeedCommand,
  START_COMMAND,
  STATUS_COMMAND,
  STOP_COMMAND,
} from '@runner/core';
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64 codec', () => {
  it.each([
    ['status', STATUS_COMMAND.payload],
    ['start', START_COMMAND.payload],
    ['stop', STOP_COMMAND.payload],
    ['incSpeed', incSpeedCommand(65, 3).payload],
  ])('round-trips the %s command frame', (_name, payload) => {
    const bytes = Uint8Array.from(payload);
    const roundTripped = base64ToBytes(bytesToBase64(bytes));
    expect(Array.from(roundTripped)).toEqual(Array.from(bytes));
  });

  it('encodes a known byte sequence to the expected base64 string', () => {
    expect(bytesToBase64(Uint8Array.from([2, 81]))).toBe('AlE=');
  });

  it('decodes a known base64 string to the expected bytes', () => {
    expect(Array.from(base64ToBytes('AlE='))).toEqual([2, 81]);
  });

  it('round-trips a 17-byte running-status frame', () => {
    const bytes = Uint8Array.from(
      Array.from({ length: 17 }, (_, i) => i * 7 + 1).map((n) => n % 256)
    );
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
