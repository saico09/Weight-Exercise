import { describe, expect, it } from 'vitest';
import { accentPresets, accentStyle, contrastRatio } from './accent';

describe('personalized accent colors', () => {
  it('retains each original theme when no custom color is selected', () => {
    expect(accentStyle('dark', null)['--accent']).toBe('#42FF85');
    expect(accentStyle('light', null)['--accent']).toBe('#91F8FF');
  });

  it('uses the same selected color in both modes, with independent legible text tones', () => {
    const dark = accentStyle('dark', '#f6d85c');
    const light = accentStyle('light', '#f6d85c');
    expect(dark['--accent']).toBe('#F6D85C');
    expect(light['--accent']).toBe(dark['--accent']);
    expect(light['--accent-ink']).not.toBe(dark['--accent-ink']);
    expect(contrastRatio(light['--accent-ink'], '#e6f0f0')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark['--accent-ink'], '#202721')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps text readable for presets and extreme custom choices, including mid gray', () => {
    const colors = [...accentPresets.map(preset => preset.color), '#000000', '#FFFFFF', '#777777', '#001144', '#F00000', '#006600'];
    for (const color of colors) {
      for (const theme of ['dark', 'light'] as const) {
        const style = accentStyle(theme, color);
        expect(contrastRatio(style['--accent'], style['--accent-contrast'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(style['--accent-ink'], theme === 'dark' ? '#202721' : '#e6f0f0')).toBeGreaterThanOrEqual(4.5);
        expect(style['--chart-accent']).toBe(style['--accent-ink']);
      }
    }
  });

  it('rejects malformed colors without placing untrusted values in styles', () => {
    for (const value of ['#fff', 'red', '#zzzzzz', '#123456; color:red', '']) {
      expect(accentStyle('light', value)).toEqual(accentStyle('light', null));
    }
  });

  it('preserves readable selected-row text when the custom tint blends into a surface', () => {
    for (const color of ['#777777', '#8A8A8A', '#000000', '#FFFFFF', '#F00000', '#FF00FF', '#F6D85C']) {
      for (const theme of ['dark', 'light'] as const) {
        const surface = theme === 'dark' ? '#202721' : '#e6f0f0';
        const alpha = theme === 'dark' ? .09 : .16;
        const tinted = '#' + [1, 3, 5].map(start => Math.round(parseInt(surface.slice(start, start + 2), 16) * (1 - alpha) + parseInt(color.slice(start, start + 2), 16) * alpha).toString(16).padStart(2, '0')).join('');
        expect(contrastRatio(accentStyle(theme, color)['--accent-ink'], tinted)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
