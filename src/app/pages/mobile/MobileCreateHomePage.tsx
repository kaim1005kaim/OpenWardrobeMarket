import React, { useState, useEffect, useRef } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { MetaballsBreathing } from '../../../components/Urula/MetaballsBreathing';
import { ModePickerSheet } from '../../components/mobile/ModePickerSheet';
import { QuickSwitchMenu } from '../../components/mobile/QuickSwitchMenu';
import { DEFAULT_DNA } from '../../../types/dna';
import { getLastUsedMode, setLastUsedMode } from '../../../lib/modeStorage';
import './MobileCreateHomePage.css';

interface MobileCreateHomePageProps {
  onNavigate?: (page: string, options?: { mode?: string; from?: string }) => void;
  onStartCreate?: (mode: string) => void;
}

export function MobileCreateHomePage({ onNavigate, onStartCreate }: MobileCreateHomePageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [showInitialPicker, setShowInitialPicker] = useState(false);
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
  const [lastMode, setLastMode] = useState<string | null>(null);

  const longPressTimer = useRef<number | null>(null);
  const urulaRef = useRef<HTMLDivElement>(null);
  const [urulaRotation, setUrulaRotation] = useState(0);
  const [urulaPulse, setUrulaPulse] = useState(false);

  useEffect(() => {
    // Check if user has used CREATE before
    const savedMode = getLastUsedMode();
    setLastMode(savedMode);

    // Show mode picker on first visit
    if (!savedMode) {
      setShowInitialPicker(true);
    }
  }, []);

  useEffect(() => {
    if (showInitialPicker) {
      const timer = setTimeout(() => {
        setIsPickerOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showInitialPicker]);

  useEffect(() => {
    // Listen for custom event from QuickSwitchMenu
    const handleOpenModePicker = () => {
      setIsPickerOpen(true);
    };

    window.addEventListener('openModePicker', handleOpenModePicker);

    return () => {
      window.removeEventListener('openModePicker', handleOpenModePicker);
    };
  }, []);

  const handleStartDesigning = () => {
    const mode = lastMode || 'fusion';
    setLastUsedMode(mode);

    if (onStartCreate) {
      onStartCreate(mode);
    } else {
      onNavigate?.('create', { mode });
    }
  };

  const handleChooseMethod = () => {
    setIsPickerOpen(true);
  };

  const handleModeSelect = (mode: string) => {
    setLastUsedMode(mode);
    setLastMode(mode);
    setIsPickerOpen(false);

    if (onStartCreate) {
      onStartCreate(mode);
    } else {
      onNavigate?.('create', { mode });
    }
  };

  // Urula interactions
  const handleUrulaTap = () => {
    setUrulaPulse(true);
    setTimeout(() => setUrulaPulse(false), 200);
  };

  const handleUrulaSwipe = (deltaX: number) => {
    setUrulaRotation(prev => prev + deltaX * 0.5);
  };

  const handleUrulaTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    let moved = false;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moved = true;
      const currentTouch = moveEvent.touches[0];
      const deltaX = currentTouch.clientX - startX;
      handleUrulaSwipe(deltaX * 0.01);
    };

    const handleTouchEnd = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!moved) {
        handleUrulaTap();
      }

      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    // Long press for quick switch
    longPressTimer.current = window.setTimeout(() => {
      setIsQuickSwitchOpen(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 600);

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleQuickSwitchSelect = (mode: string) => {
    setIsQuickSwitchOpen(false);
    handleModeSelect(mode);
  };

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <div className="mobile-create-home-page">
      {/* Header */}
      <header className="create-home-header">
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="create-logo-btn" onClick={() => onNavigate?.('studio')}>
          OWM
        </button>
      </header>

      <div className="create-home-content">
        {/* Urula Hero */}
        <div
          ref={urulaRef}
          className={`create-hero-urula ${urulaPulse ? 'pulse' : ''}`}
          onTouchStart={handleUrulaTouchStart}
          style={{ transform: `rotate(${urulaRotation}deg)` }}
        >
          <div className="urula-canvas">
            <MetaballsBreathing dna={DEFAULT_DNA} animated={true} />
          </div>
        </div>

        {/* Title */}
        <h1 className="create-home-title">CREATE</h1>

        {/* Subtitle */}
        <p className="create-home-subtitle">
          Pick, answer, and speak to Urula.<br />
          Let your design emerge.
        </p>

        {/* Primary CTA */}
        <button className="cta-start-designing" onClick={handleStartDesigning}>
          START DESIGNING
        </button>

        {/* Mode indicator */}
        {lastMode && (
          <p className="mode-indicator">
            {getModeDisplayName(lastMode)}
          </p>
        )}

        {/* Secondary Link */}
        <button className="link-choose-method" onClick={handleChooseMethod}>
          CHOOSE A METHOD
        </button>

        {/* Footer Link */}
        <button className="link-how-it-works" onClick={() => console.log('How it works')}>
          HOW IT WORKS
        </button>
      </div>

      {/* Mode Picker BottomSheet */}
      <ModePickerSheet
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectMode={handleModeSelect}
        lastUsedMode={lastMode}
      />

      {/* Quick Switch Menu */}
      <QuickSwitchMenu
        isOpen={isQuickSwitchOpen}
        onClose={() => setIsQuickSwitchOpen(false)}
        onSelectMode={handleQuickSwitchSelect}
        lastUsedMode={lastMode}
      />

      {/* Menu Overlay */}
      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />
    </div>
  );
}

function getModeDisplayName(mode: string): string {
  const names: Record<string, string> = {
    fusion: 'FUSION',
    composer: 'COMPOSER',
    camera: 'CAMERA',
    sketch: 'SKETCH',
    prompt: 'PROMPT',
    remix: 'REMIX',
    variations: 'VARIATIONS',
  };
  return names[mode] || mode.toUpperCase();
}
