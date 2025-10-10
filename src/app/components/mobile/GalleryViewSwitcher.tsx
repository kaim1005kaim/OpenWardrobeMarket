import React from 'react';
import './GalleryViewSwitcher.css';

export type GalleryViewMode = 'clean' | 'poster';

interface GalleryViewSwitcherProps {
  mode: GalleryViewMode;
  onModeChange: (mode: GalleryViewMode) => void;
}

export function GalleryViewSwitcher({ mode, onModeChange }: GalleryViewSwitcherProps) {
  return (
    <>
      <div className="view-switcher">
        <button
          className={`switch-btn ${mode === 'clean' ? 'active' : ''}`}
          onClick={() => onModeChange('clean')}
        >
          <span className="icon">📷</span>
          <span className="label">Clean</span>
        </button>
        <button
          className={`switch-btn ${mode === 'poster' ? 'active' : ''}`}
          onClick={() => onModeChange('poster')}
        >
          <span className="icon">🎨</span>
          <span className="label">Poster</span>
        </button>
      </div>
    </>
  );
}
