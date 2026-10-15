export interface MotivationPreferences { message: string; image: string | null }

export const DEFAULT_MOTIVATION_IMAGE = '/images/motivation-kitten.jpg';
export const MAX_MOTIVATION_IMAGE_LENGTH = 250_000;
export const defaultMotivation = (): MotivationPreferences => ({ message: 'Hazlo por él', image: null });

/** Only embedded raster images are accepted. Never load an arbitrary remote URL or SVG. */
export function validMotivationImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_MOTIVATION_IMAGE_LENGTH) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    const prefix = atob(match[2].slice(0, 48));
    if (match[1] === 'jpeg') return prefix.startsWith('\xff\xd8\xff');
    if (match[1] === 'png') return prefix.startsWith('\x89PNG\r\n\x1a\n');
    return prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
  } catch { return false; }
}

export function normalizeMotivation(value: unknown): MotivationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultMotivation();
  const input = value as Record<string, unknown>;
  return {
    message: typeof input.message === 'string' && input.message.trim() ? input.message.trim().slice(0, 180) : 'Hazlo por él',
    image: validMotivationImage(input.image) ? input.image : null,
  };
}

/** Decode, resize and re-encode locally. This also strips metadata such as GPS. */
export async function prepareMotivationImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elige una foto JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Elige una foto de hasta 10 MB.');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    try { await image.decode(); } catch { throw new Error('No pudimos abrir esa imagen. Prueba con otra foto.'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('La imagen es demasiado grande. Elige una versión más pequeña.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No pudimos preparar la foto. Inténtalo de nuevo.');
    context.fillStyle = '#f3f3f0';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.84, .7, .56, .42]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (validMotivationImage(result)) return result;
    }
    throw new Error('La foto sigue siendo muy pesada. Elige otra más sencilla.');
  } finally { URL.revokeObjectURL(source); }
}
