import React from 'react';

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

      <style jsx>{`
        .view-switcher {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: #FFFFFF;
          border-bottom: 1px solid #E5E5E5;
        }

        .switch-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          background: #F5F5F5;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #666666;
        }

        .switch-btn.active {
          background: #FFFFFF;
          border-color: #000000;
          color: #000000;
        }

        .switch-btn:hover:not(.active) {
          background: #EEEEEE;
        }

        .icon {
          font-size: 18px;
          line-height: 1;
        }

        .label {
          font-weight: 600;
          letter-spacing: 0.5px;
        }
      `}</style>
    </>
  );
}
