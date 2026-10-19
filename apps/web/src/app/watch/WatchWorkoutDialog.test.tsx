import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { temporaryProgramAtom } from '../atoms';
import { store } from '../store';
import { autostartRunAtom } from './temporaryProgram';
import WatchWorkoutDialog from './WatchWorkoutDialog';

const push = vi.fn();
let hrConnected = true;
let reading: { workout: { name?: string; text: string } | null } = { workout: null };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../ble/bluetoothAvailability', () => ({ useBluetoothAvailability: () => 'available' }));
vi.mock('../ble/useDeviceConnection', () => ({ useHeartRateConnected: () => hrConnected }));
vi.mock('./ocr', () => ({
  recognizeWatchPhoto: vi.fn(async () => ({ ...reading, rawTexts: [] })),
}));
vi.mock('../offline/sync', () => ({
  enqueueWrite: vi.fn(async () => undefined),
  getPendingWrites: vi.fn(async () => []),
}));

const photo = new File(['jpeg'], 'watch.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:watch');
  URL.revokeObjectURL = vi.fn();
  store.set(temporaryProgramAtom, null);
  store.set(autostartRunAtom, false);
  push.mockClear();
  hrConnected = true;
});

afterEach(cleanup);

describe('WatchWorkoutDialog', () => {
  it('previews what it read and starts it as a temporary workout', async () => {
    reading = { workout: { name: 'Próg', text: '21:00@169bpm 41:00' } };
    const onClose = vi.fn();
    render(<WatchWorkoutDialog photo={photo} onClose={onClose} onRetake={vi.fn()} />);

    expect(await screen.findByDisplayValue('21:00@169bpm 41:00')).toBeTruthy();
    expect(screen.getByDisplayValue('Próg')).toBeTruthy();
    expect(screen.getByText('Total 41:00')).toBeTruthy();
    expect(screen.getAllByText('10:00')).toHaveLength(2);
    expect(screen.getByText('169 bpm')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/running'));
    expect(store.get(temporaryProgramAtom)).toEqual({ name: 'Próg' });
    expect(store.get(autostartRunAtom)).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the workout be typed when the photo could not be read', async () => {
    reading = { workout: null };
    hrConnected = false;
    render(<WatchWorkoutDialog photo={photo} onClose={vi.fn()} onRetake={vi.fn()} />);

    expect(await screen.findByText(/Couldn't read the workout/)).toBeTruthy();
    const use = screen.getByRole('button', { name: 'Use workout' }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Workout'), { target: { value: '143bpm 31:00' } });
    expect(screen.getByText('Total 31:00')).toBeTruthy();
    fireEvent.click(use);

    // Without the heart-rate monitor it's only put in place, not started.
    await vi.waitFor(() =>
      expect(store.get(temporaryProgramAtom)).toEqual({ name: 'Watch workout' })
    );
    expect(push).not.toHaveBeenCalled();
    expect(store.get(autostartRunAtom)).toBe(false);
  });

  it('explains a workout it cannot parse', async () => {
    reading = { workout: { text: '143bpm 31:00' } };
    render(<WatchWorkoutDialog photo={photo} onClose={vi.fn()} onRetake={vi.fn()} />);

    fireEvent.change(await screen.findByDisplayValue('143bpm 31:00'), {
      target: { value: '21:00@169 20:00' },
    });
    expect(screen.getByText(/shorter than the workout itself/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
