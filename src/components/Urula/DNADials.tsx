import React from 'react';
import type { DNA } from '../../types/dna';

interface DNADialsProps {
  dna: DNA;
  onChange: (dna: DNA) => void;
  disabled?: boolean;
}

/**
 * DNA Dials: UI controls for adjusting DNA parameters
 * Compact vertical sliders for mobile-first design
 */
export function DNADials({ dna, onChange, disabled }: DNADialsProps) {
  const handleChange = (key: keyof DNA, value: number) => {
    onChange({ ...dna, [key]: value });
  };

  const dialGroups = [
    {
      label: 'Color',
      dials: [
        { key: 'hue' as const, label: 'Hue', min: 0, max: 1, step: 0.01 },
        { key: 'sat' as const, label: 'Sat', min: 0, max: 1, step: 0.01 },
        { key: 'light' as const, label: 'Light', min: 0, max: 1, step: 0.01 },
      ],
    },
    {
      label: 'Style',
      dials: [
        {
          key: 'minimal_maximal' as const,
          label: 'Min/Max',
          min: -1,
          max: 1,
          step: 0.1,
        },
        {
          key: 'street_luxury' as const,
          label: 'Street/Lux',
          min: -1,
          max: 1,
          step: 0.1,
        },
        {
          key: 'oversized_fitted' as const,
          label: 'Size',
          min: -1,
          max: 1,
          step: 0.1,
        },
        {
          key: 'relaxed_tailored' as const,
          label: 'Fit',
          min: -1,
          max: 1,
          step: 0.1,
        },
      ],
    },
    {
      label: 'Texture',
      dials: [{ key: 'texture' as const, label: 'Texture', min: 0, max: 1, step: 0.01 }],
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.05)',
        borderRadius: '8px',
      }}
    >
      {dialGroups.map((group) => (
        <div key={group.label}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {group.label}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {group.dials.map((dial) => (
              <div
                key={dial.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <label
                  style={{
                    fontSize: '10px',
                    color: '#999',
                    textAlign: 'center',
                  }}
                >
                  {dial.label}
                </label>
                <input
                  type="range"
                  min={dial.min}
                  max={dial.max}
                  step={dial.step}
                  value={dna[dial.key]}
                  onChange={(e) => handleChange(dial.key, parseFloat(e.target.value))}
                  disabled={disabled}
                  style={{
                    width: '60px',
                    accentColor: '#000',
                  }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    color: '#666',
                    fontFamily: 'monospace',
                  }}
                >
                  {dna[dial.key].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
