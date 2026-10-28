import { variacionPct } from './dashboard.service';

describe('variacionPct', () => {
  it('computes the change with one decimal', () => {
    expect(variacionPct(1500, 1000)).toBe(50);
    expect(variacionPct(800, 1000)).toBe(-20);
    expect(variacionPct(1234, 1000)).toBe(23.4);
  });

  it('returns null when there is no previous month to compare', () => {
    expect(variacionPct(500, 0)).toBeNull();
    expect(variacionPct(0, 0)).toBeNull();
  });
});
