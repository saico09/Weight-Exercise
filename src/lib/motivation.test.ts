import { describe, expect, it } from 'vitest';
import { MAX_MOTIVATION_IMAGE_LENGTH, defaultMotivation, normalizeMotivation, validMotivationImage } from './motivation';

describe('local motivation settings', () => {
  it('migrates absent or malformed preferences to a kitten and the requested message', () => {
    expect(normalizeMotivation(undefined)).toEqual(defaultMotivation());
    expect(normalizeMotivation({ message: '   ', image: 'https://tracker.invalid/photo' })).toEqual(defaultMotivation());
  });
  it('keeps bounded text and valid embedded raster data only', () => {
    const jpeg = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff\xe0test');
    expect(normalizeMotivation({ message: '  My reason  ', image: jpeg })).toEqual({ message: 'My reason', image: jpeg });
    expect(normalizeMotivation({ message: 'x'.repeat(400), image: null }).message).toHaveLength(180);
  });
  it('rejects SVG, MIME spoofing, malformed base64 and oversized payloads', () => {
    expect(validMotivationImage('data:image/svg+xml;base64,' + btoa('<svg></svg>'))).toBe(false);
    expect(validMotivationImage('data:image/jpeg;base64,' + btoa('<svg></svg>'))).toBe(false);
    expect(validMotivationImage('data:image/png;base64,!')).toBe(false);
    expect(validMotivationImage('data:image/jpeg;base64,/9j/' + 'A'.repeat(MAX_MOTIVATION_IMAGE_LENGTH))).toBe(false);
  });
});
