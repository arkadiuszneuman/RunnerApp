import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SegmentedControl from './SegmentedControl';

const OPTIONS = [
  { value: 'legacy' as const, label: 'Classic', color: '#ffb547' },
  { value: 'adaptive' as const, label: 'Adaptive', color: '#38e1ff' },
];

afterEach(cleanup);

describe('SegmentedControl', () => {
  it('marks the selected option pressed and the other not', () => {
    render(
      <SegmentedControl aria-label="Speed controller" value="legacy" onChange={() => {}} options={OPTIONS} />
    );
    expect(screen.getByRole('button', { name: 'Classic' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Adaptive' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('fires onChange with the clicked option', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl aria-label="Speed controller" value="legacy" onChange={onChange} options={OPTIONS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Adaptive' }));
    expect(onChange).toHaveBeenCalledWith('adaptive');
  });

  it('does not fire onChange when clicking the already-selected option', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl aria-label="Speed controller" value="legacy" onChange={onChange} options={OPTIONS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables every option when disabled', () => {
    render(
      <SegmentedControl aria-label="Speed controller" value="legacy" onChange={() => {}} disabled options={OPTIONS} />
    );
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Adaptive' })).toHaveProperty('disabled', true);
  });
});
