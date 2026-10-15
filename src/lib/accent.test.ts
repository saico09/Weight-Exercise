import { describe, expect, it } from 'vitest';
import { defaultData, validateData } from './model';
import { accentStyle } from './accent';
describe('Basic appearance boundary', () => {
  it('does not enable custom colors or Pro themes from edited preferences', () => {
    for (const theme of ['aurora', 'sand']) {
      const data = defaultData();
      const restored = validateData({ ...data, settings: { ...data.settings, theme, accentColor: '#BB9BFF', recap: {enabled:true,period:'weekly',time:'19:00'} } })!;
      expect(restored.settings.theme).toBe('dark');
      expect(restored.settings.accentColor).toBeNull();
      expect(restored.settings.recap.enabled).toBe(false);
      expect(accentStyle(restored.settings.theme)['--accent']).toBe('#42FF85');
    }
  });
});
