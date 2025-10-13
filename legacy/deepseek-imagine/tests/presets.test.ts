import { describe, test, expect } from 'vitest';
import { PRESETS } from '@/app/lib/data';

describe('PRESETS', () => {
  test('PRESETS defined and valid shape', () => {
    expect(Array.isArray(PRESETS)).toBe(true);
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    
    const requiredKeys = ['id', 'label', 'vibe', 'palette', 'silhouette', 'season'];
    PRESETS.forEach((preset) => {
      requiredKeys.forEach((key) => {
        expect(preset).toHaveProperty(key);
        expect(typeof (preset as any)[key]).toBe('string');
        expect((preset as any)[key].length).toBeGreaterThan(0);
      });
    });
  });
});
