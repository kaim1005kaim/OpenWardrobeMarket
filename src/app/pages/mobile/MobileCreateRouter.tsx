import React, { useState, useEffect } from 'react';
import { MobileCreatePage } from './MobileCreatePage'; // COMPOSER mode (existing)
import { MobileFusionPage } from './MobileFusionPage'; // FUSION mode
import { CreateMode, getDefaultMode } from '../../../lib/modeStorage';
import './MobileCreateRouter.css';

interface MobileCreateRouterProps {
  mode?: string;
  onNavigate?: (page: string, options?: any) => void;
  onStartPublish?: (imageUrl: string, generationData: any) => void;
}

export function MobileCreateRouter({
  mode: initialMode,
  onNavigate,
  onStartPublish,
}: MobileCreateRouterProps) {
  const [currentMode, setCurrentMode] = useState<CreateMode>(() => {
    if (initialMode && isValidMode(initialMode)) {
      return initialMode as CreateMode;
    }
    return getDefaultMode();
  });

  useEffect(() => {
    if (initialMode && isValidMode(initialMode)) {
      setCurrentMode(initialMode as CreateMode);
    }
  }, [initialMode]);

  switch (currentMode) {
    case 'fusion':
      return (
        <MobileFusionPage
          onNavigate={onNavigate}
          onStartPublish={onStartPublish}
        />
      );

    case 'composer':
      // Use existing MobileCreatePage for COMPOSER mode
      return (
        <MobileCreatePage
          onNavigate={onNavigate}
          onStartPublish={onStartPublish}
        />
      );

    case 'camera':
      return (
        <div className="mode-placeholder">
          <div className="mode-placeholder-content">
            <h1 className="mode-placeholder-title">CAMERA</h1>
            <p className="mode-placeholder-subtitle">LIVE CAPTURE</p>
            <p className="mode-placeholder-description">
              Shoot textures, shapes, or scenes.<br />
              Urula extracts patterns in real time.
            </p>
            <div className="mode-placeholder-status">Coming Soon</div>
            <button
              className="mode-placeholder-back"
              onClick={() => onNavigate?.('create-home')}
            >
              ← BACK TO CREATE
            </button>
          </div>
        </div>
      );

    case 'sketch':
      return (
        <div className="mode-placeholder">
          <div className="mode-placeholder-content">
            <h1 className="mode-placeholder-title">SKETCH</h1>
            <p className="mode-placeholder-subtitle">LINE & SHAPE</p>
            <p className="mode-placeholder-description">
              Rough lines are enough.<br />
              Urula infers silhouette and material mood.
            </p>
            <div className="mode-placeholder-status">Coming Soon</div>
            <button
              className="mode-placeholder-back"
              onClick={() => onNavigate?.('create-home')}
            >
              ← BACK TO CREATE
            </button>
          </div>
        </div>
      );

    case 'prompt':
      return (
        <div className="mode-placeholder">
          <div className="mode-placeholder-content">
            <h1 className="mode-placeholder-title">PROMPT</h1>
            <p className="mode-placeholder-subtitle">FREE TEXT + GUIDANCE</p>
            <p className="mode-placeholder-description">
              Write freely.<br />
              Urula refines it into production-grade prompts.
            </p>
            <div className="mode-placeholder-status">Coming Soon</div>
            <button
              className="mode-placeholder-back"
              onClick={() => onNavigate?.('create-home')}
            >
              ← BACK TO CREATE
            </button>
          </div>
        </div>
      );

    case 'remix':
      return (
        <div className="mode-placeholder">
          <div className="mode-placeholder-content">
            <h1 className="mode-placeholder-title">REMIX</h1>
            <p className="mode-placeholder-subtitle">FROM YOUR WORK</p>
            <p className="mode-placeholder-description">
              Pick one of your designs.<br />
              Urula remixes without losing the core DNA.
            </p>
            <div className="mode-placeholder-status">Coming Soon</div>
            <button
              className="mode-placeholder-back"
              onClick={() => onNavigate?.('create-home')}
            >
              ← BACK TO CREATE
            </button>
          </div>
        </div>
      );

    case 'variations':
      return (
        <div className="mode-placeholder">
          <div className="mode-placeholder-content">
            <h1 className="mode-placeholder-title">VARIATIONS</h1>
            <p className="mode-placeholder-subtitle">MICRO-TWEAKS</p>
            <p className="mode-placeholder-description">
              Generate coherent variations—<br />
              colorways, trims, or proportions.
            </p>
            <div className="mode-placeholder-status">Coming Soon</div>
            <button
              className="mode-placeholder-back"
              onClick={() => onNavigate?.('create-home')}
            >
              ← BACK TO CREATE
            </button>
          </div>
        </div>
      );

    default:
      return (
        <MobileCreatePage
          onNavigate={onNavigate}
          onStartPublish={onStartPublish}
        />
      );
  }
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
