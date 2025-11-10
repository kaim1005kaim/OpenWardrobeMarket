/**
 * Mode Storage
 * Manages last-used mode persistence in localStorage and user_meta
 */

const STORAGE_KEY = 'owm:lastMode';
const DEFAULT_MODE = 'fusion';

export type CreateMode =
  | 'fusion'
  | 'composer'
  | 'camera'
  | 'sketch'
  | 'prompt'
  | 'remix'
  | 'variations';

export function getLastUsedMode(): CreateMode | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidMode(stored)) {
      return stored as CreateMode;
    }
  } catch (error) {
    console.error('[modeStorage] Failed to read last mode:', error);
  }

  return null;
}

export function setLastUsedMode(mode: CreateMode): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    console.error('[modeStorage] Failed to save last mode:', error);
  }
}

export function getDefaultMode(): CreateMode {
  return getLastUsedMode() || DEFAULT_MODE;
}

function isValidMode(mode: string): boolean {
  const validModes: CreateMode[] = [
    'fusion',
    'composer',
    'camera',
    'sketch',
    'prompt',
    'remix',
    'variations',
  ];
  return validModes.includes(mode as CreateMode);
}

export const MODE_METADATA = {
  fusion: {
    title: 'FUSION',
    subtitle: 'IMAGE × IMAGE',
    badge: 'RECOMMENDED',
    description: 'Blend two images you love. Urula will abstract them into a new design DNA.',
    duration: '~2 MIN',
    requirements: 'REQUIRES 2 IMAGES',
    inputs: ['Upload/Capture 2 images', 'Optional text prompt'],
    icon: '🔀',
  },
  composer: {
    title: 'COMPOSER',
    subtitle: 'QUESTION-LED',
    badge: null,
    description: 'Answer a few cues. Urula composes a design voice from your choices.',
    duration: '~3 MIN',
    requirements: '6 QUESTIONS',
    inputs: ['Answer 6 design questions', 'Optional refinement'],
    icon: '📝',
  },
  camera: {
    title: 'CAMERA',
    subtitle: 'LIVE CAPTURE',
    badge: null,
    description: 'Shoot textures, shapes, or scenes. Urula extracts patterns in real time.',
    duration: '~2 MIN',
    requirements: '1-3 PHOTOS',
    inputs: ['Capture 1-3 photos', 'Auto-analysis'],
    icon: '📷',
  },
  sketch: {
    title: 'SKETCH',
    subtitle: 'LINE & SHAPE',
    badge: null,
    description: 'Rough lines are enough. Urula infers silhouette and material mood.',
    duration: '~2 MIN',
    requirements: '1 SKETCH',
    inputs: ['Upload sketch image', 'Optional style hints'],
    icon: '✏️',
  },
  prompt: {
    title: 'PROMPT',
    subtitle: 'FREE TEXT + GUIDANCE',
    badge: null,
    description: 'Write freely. Urula refines it into production-grade prompts.',
    duration: '~1 MIN',
    requirements: 'TEXT ONLY',
    inputs: ['Free-form text', 'AI refinement'],
    icon: '💬',
  },
  remix: {
    title: 'REMIX',
    subtitle: 'FROM YOUR WORK',
    badge: null,
    description: 'Pick one of your designs. Urula remixes without losing the core DNA.',
    duration: '~2 MIN',
    requirements: '1 EXISTING DESIGN',
    inputs: ['Select from your work', 'Remix parameters'],
    icon: '🔄',
  },
  variations: {
    title: 'VARIATIONS',
    subtitle: 'MICRO-TWEAKS',
    badge: null,
    description: 'Generate coherent variations—colorways, trims, or proportions.',
    duration: '~2 MIN',
    requirements: 'BASE IMAGE + PARAMS',
    inputs: ['Base image', 'Variation controls'],
    icon: '🎨',
  },
} as const;
