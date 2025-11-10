import React, { useEffect } from 'react';
import { CreateMode, MODE_METADATA } from '../../../lib/modeStorage';
import './QuickSwitchMenu.css';

interface QuickSwitchMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: CreateMode) => void;
  lastUsedMode: string | null;
}

export function QuickSwitchMenu({
  isOpen,
  onClose,
  onSelectMode,
  lastUsedMode,
}: QuickSwitchMenuProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.quick-switch-menu')) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const recommendedMode: CreateMode = 'fusion';
  const quickOptions: CreateMode[] = [
    lastUsedMode as CreateMode,
    recommendedMode,
  ].filter((mode, index, arr) => mode && arr.indexOf(mode) === index);

  // Add "All Methods" option
  const options = [
    ...quickOptions,
    'all' as CreateMode, // Special value for "All Methods"
  ];

  const handleSelect = (mode: CreateMode | 'all') => {
    if (mode === 'all') {
      // This should open the full mode picker
      onClose();
      // Trigger mode picker opening via parent
      const event = new CustomEvent('openModePicker');
      window.dispatchEvent(event);
    } else {
      onSelectMode(mode);
    }
  };

  return (
    <div className="quick-switch-overlay">
      <div className="quick-switch-menu">
        <div className="quick-switch-header">
          <span className="quick-switch-title">QUICK SWITCH</span>
        </div>

        <div className="quick-switch-options">
          {options.map((option) => {
            if (option === 'all') {
              return (
                <button
                  key="all"
                  className="quick-switch-option all-methods"
                  onClick={() => handleSelect('all')}
                >
                  <span className="quick-switch-icon">⋯</span>
                  <span className="quick-switch-label">ALL METHODS</span>
                </button>
              );
            }

            const meta = MODE_METADATA[option];
            const label =
              option === lastUsedMode ? 'LAST USED' : option === recommendedMode ? 'RECOMMENDED' : '';

            return (
              <button
                key={option}
                className="quick-switch-option"
                onClick={() => handleSelect(option)}
              >
                <span className="quick-switch-icon">{meta.icon}</span>
                <div className="quick-switch-content">
                  <span className="quick-switch-label">{meta.title}</span>
                  {label && <span className="quick-switch-badge">{label}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
