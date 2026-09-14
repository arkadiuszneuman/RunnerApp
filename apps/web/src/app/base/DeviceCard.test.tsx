import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeviceCard from './DeviceCard';

afterEach(cleanup);

const BASE_PROPS = {
  icon: <span data-testid="icon" />,
  color: '#38e1ff',
  title: 'Treadmill',
  status: 'Pairs when you connect',
  onConnect: vi.fn(),
  onChange: vi.fn(),
  onForget: vi.fn(),
};

describe('DeviceCard', () => {
  it('shows a plain Connect button and no menu when nothing is remembered', () => {
    render(<DeviceCard {...BASE_PROPS} connected={false} connecting={false} remembered={false} />);

    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Treadmill options' })).toBeNull();
  });

  it('shows Connect plus a Change/Forget menu when remembered but disconnected', () => {
    const onChange = vi.fn();
    const onForget = vi.fn();
    render(
      <DeviceCard
        {...BASE_PROPS}
        connected={false}
        connecting={false}
        remembered
        onChange={onChange}
        onForget={onForget}
      />
    );

    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Treadmill options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change device' }));
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Treadmill options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Forget' }));
    expect(onForget).toHaveBeenCalledTimes(1);
  });

  it('shows Live and the menu, and hides Connect, once connected', () => {
    render(<DeviceCard {...BASE_PROPS} connected connecting={false} remembered />);

    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Treadmill options' })).toBeTruthy();
  });

  it('disables Connect while connecting, and the menu while menuDisabled', () => {
    render(<DeviceCard {...BASE_PROPS} connected={false} connecting remembered menuDisabled />);

    expect(screen.getByRole('button', { name: 'Connect' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Treadmill options' })).toHaveProperty(
      'disabled',
      true
    );
  });
});
