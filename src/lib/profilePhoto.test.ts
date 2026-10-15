import { describe, expect, it } from 'vitest';
import { demoData, validateData } from './model';
import { validProfilePhoto, MAX_PROFILE_PHOTO_LENGTH } from './profilePhoto';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNc8AAAAASUVORK5CYII=';

describe('local profile photos', () => {
  it('accepts small embedded raster images, rejects remote/SVG/oversized/mismatched payloads', () => {
    expect(validProfilePhoto(png)).toBe(true);
    for (const input of ['https://example.com/photo.png', 'data:image/svg+xml;base64,PHN2Zz4=', png.replace('image/png', 'image/jpeg'), 'data:image/png;base64,' + 'A'.repeat(MAX_PROFILE_PHOTO_LENGTH), null]) expect(validProfilePhoto(input)).toBe(false);
  });
  it('preserves the photo across storage validation and removes unsupported photo data', () => {
    const data = demoData(); data.profile!.photo = png;
    expect(validateData(data)?.profile?.photo).toBe(png);
    data.profile!.photo = 'https://tracker.example/avatar';
    expect(validateData(data)?.profile?.photo).toBeUndefined();
    delete data.profile!.photo;
    expect(validateData(data)?.profile).toEqual(data.profile);
  });
});
