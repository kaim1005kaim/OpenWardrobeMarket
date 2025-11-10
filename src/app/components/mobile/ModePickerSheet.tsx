import React, { useEffect } from 'react';
import { CreateMode, MODE_METADATA } from '../../../lib/modeStorage';
import './ModePickerSheet.css';

interface ModePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: CreateMode) => void;
  lastUsedMode: string | null;
}

export function ModePickerSheet({
  isOpen,
  onClose,
  onSelectMode,
  lastUsedMode,
}: ModePickerSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Sort modes: FUSION first, then last used, then alphabetical
  const modes: CreateMode[] = [
    'fusion',
    'composer',
    'camera',
    'sketch',
    'prompt',
    'remix',
    'variations',
  ];

  const sortedModes = [...modes].sort((a, b) => {
    if (a === 'fusion') return -1;
    if (b === 'fusion') return 1;
    if (a === lastUsedMode) return -1;
    if (b === lastUsedMode) return 1;
    return 0;
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="mode-picker-backdrop" onClick={handleBackdropClick}>
      <div className="mode-picker-sheet">
        {/* Handle bar */}
        <div className="mode-picker-handle" />

        {/* Header */}
        <div className="mode-picker-header">
          <h2 className="mode-picker-title">CHOOSE A METHOD</h2>
          <button className="mode-picker-close" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Mode Cards */}
        <div className="mode-picker-content">
          {sortedModes.map((mode) => {
            const meta = MODE_METADATA[mode];
            const isRecommended = mode === 'fusion' || mode === lastUsedMode;

            return (
              <button
                key={mode}
                className={`mode-card ${isRecommended ? 'recommended' : ''}`}
                onClick={() => onSelectMode(mode)}
              >
                <div className="mode-card-icon">{meta.icon}</div>

                <div className="mode-card-content">
                  <div className="mode-card-header">
                    <div>
                      <h3 className="mode-card-title">
                        {meta.title}
                        {meta.subtitle && (
                          <span className="mode-card-subtitle"> {meta.subtitle}</span>
                        )}
                      </h3>
                      {isRecommended && (
                        <span className="mode-card-badge">
                          {mode === 'fusion' ? 'RECOMMENDED' : 'LAST USED'}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mode-card-description">{meta.description}</p>

                  <div className="mode-card-meta">
                    <span className="mode-meta-item">{meta.duration}</span>
                    <span className="mode-meta-divider">·</span>
                    <span className="mode-meta-item">{meta.requirements}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
