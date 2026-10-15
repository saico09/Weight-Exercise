import { validMotivationImage } from './motivation';

export const MAX_PROFILE_PHOTO_LENGTH = 80_000;

/** Only small, embedded raster images. URLs and SVG never enter the profile. */
export function validProfilePhoto(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_PROFILE_PHOTO_LENGTH && validMotivationImage(value);
}

/** A local square thumbnail; re-encoding strips location and other source metadata. */
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elige una foto JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Elige una foto de hasta 10 MB.');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    try { await image.decode(); } catch { throw new Error('No pudimos abrir esa imagen. Prueba con otra foto.'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('La imagen es demasiado grande. Elige una versión más pequeña.');
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No pudimos preparar la foto. Inténtalo de nuevo.');
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    context.fillStyle = '#f3f3f0'; context.fillRect(0, 0, 256, 256);
    context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
    for (const quality of [.85, .7, .5]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (validProfilePhoto(result)) return result;
    }
    throw new Error('La foto sigue siendo muy pesada. Elige otra más sencilla.');
  } finally { URL.revokeObjectURL(source); }
}
