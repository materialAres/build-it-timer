import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CityCell } from '@/components/city/CityCell';

/**
 * M3.T5 — grow/destroy transitions. Animations are globally disabled in
 * `tests/setup.ts` (`MotionGlobalConfig.skipAnimations`), so these tests never
 * assert on timing: they verify that a transition settles on the correct final
 * DOM, which is the only stable contract of a visual transition.
 */
describe('CityCell animations (M3.T5)', () => {
  afterEach(cleanup);

  it('renders a cell that just became occupied with its character and color', () => {
    const { container } = render(<CityCell char="#" color="#ff0000" />);

    const cell = container.querySelector('.city-cell');
    expect(cell).not.toBeNull();
    expect(cell).toHaveTextContent('#');
    expect(cell).toHaveStyle({ color: '#ff0000' });
    expect(cell).not.toHaveClass('city-cell--empty');
  });

  it('settles on the character after an empty → occupied transition (growth)', () => {
    const { container, rerender } = render(<CityCell char={null} />);
    expect(container.querySelector('.city-cell')).toHaveClass(
      'city-cell--empty',
    );

    rerender(<CityCell char="[" color="#00ff00" />);

    const cell = container.querySelector('.city-cell');
    expect(cell).toHaveTextContent('[');
    expect(cell).toHaveStyle({ color: '#00ff00' });
  });

  it('removes the character when a cell is destroyed (occupied → empty)', () => {
    const { container, rerender } = render(<CityCell char="#" color="#ff0000" />);
    expect(container.querySelector('.city-cell')).toHaveTextContent('#');

    rerender(<CityCell char={null} color="#ff0000" />);

    const cell = container.querySelector('.city-cell');
    expect(cell).toHaveClass('city-cell--empty');
    expect(container.textContent).not.toContain('#');
    expect(cell).not.toHaveAttribute('style');
  });

  it('exposes exactly one rendered cell per state (aligned grid placeholder)', () => {
    const { container, rerender } = render(<CityCell char="|" />);
    expect(container.querySelectorAll('.city-cell')).toHaveLength(1);

    rerender(<CityCell char={null} />);
    expect(container.querySelectorAll('.city-cell')).toHaveLength(1);
  });
});
