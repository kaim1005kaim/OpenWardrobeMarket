import { describe, test, expect } from 'vitest';
import { safeJoin, personaWords, buildPrompt } from '@/app/lib/prompt';

describe('Prompt Functions', () => {
  test('safeJoin removes undefined/null/empty and trims', () => {
    const result = safeJoin([undefined, '  a  ', null, '', 'b ']);
    expect(result).toBe('a | b');
  });

  test('buildPrompt with only vibe+silhouette', () => {
    const result = buildPrompt({ vibe: 'minimal', silhouette: 'tailored' });
    expect(result).toBe('minimal fashion | tailored silhouette');
  });

  test('buildPrompt with notes only', () => {
    const result = buildPrompt({ notes: 'hidden placket' });
    expect(result).toBe('hidden placket');
  });

  test('buildPrompt with palette and blank season', () => {
    const result = buildPrompt({ palette: 'black', season: undefined });
    expect(result).toBe('black palette');
  });

  test('buildPrompt merges signature', () => {
    const result = buildPrompt({ vibe: 'street', signature: 'contrast stitching' });
    expect(result).toBe('street fashion | contrast stitching');
  });

  test('personaWords maps extremes', () => {
    const words = personaWords({ axisCleanBold: 0, axisClassicFuture: 100, axisSoftSharp: 70 });
    expect(words).toContain('clean');
    expect(words).toContain('future');
    expect(words).toContain('sharp');
  });

  test('personaWords balanced collapses to single balanced', () => {
    const words = personaWords({ axisCleanBold: 50, axisClassicFuture: 50, axisSoftSharp: 50 });
    expect(words).toEqual(['balanced']);
  });

  test('buildPrompt adds tones only when axes present', () => {
    const result = buildPrompt({ vibe: 'minimal', axisCleanBold: 80 });
    expect(result.includes('tone:bold')).toBe(true);
    expect(result.startsWith('minimal fashion')).toBe(true);
  });

  test('buildPrompt has no tones when axes absent', () => {
    const result = buildPrompt({ vibe: 'minimal' });
    expect(result.includes('tone:')).toBe(false);
  });
});
