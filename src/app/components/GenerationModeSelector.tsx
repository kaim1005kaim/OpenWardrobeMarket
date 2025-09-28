'use client';

import React, { useState } from 'react';
import { GenerationMode, constraintToPrompt, materialToPrompt, generateRandomMutationDeck, getConstraintInfo, getMaterialInfo } from '../lib/promptBuilder';
import { Icons } from './Icons';

interface GenerationModeSelectorProps {
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  heritageSettings?: {
    code: string;
    ratio: number;
  };
  onHeritageChange?: (settings: { code: string; ratio: number }) => void;
  zeroSettings?: {
    code: string;
    ratio: number;
  };
  onZeroChange?: (settings: { code: string; ratio: number }) => void;
  mutationSettings?: {
    constraints: string[];
    materials: string[];
  };
  onMutationChange?: (settings: { constraints: string[]; materials: string[] }) => void;
}

const modeDescriptions = {
  simple: 'シンプルな生成 - 自由なプロンプトで直接生成',
  heritage: '継承モード - 既存の名作スタイルを参照',
  zero: 'ゼロモード - 既知のスタイルから意図的に離れる',
  mutation: '変異モード - 制約と素材で創発を誘発',
};

const heritageOptions = [
  { code: 'comme', name: 'Comme des Garçons', description: '解体と非対称' },
  { code: 'margiela', name: 'Maison Margiela', description: '脱構築と職人技' },
  { code: 'dries', name: 'Dries Van Noten', description: '折衷的なプリント' },
  { code: 'yohji', name: 'Yohji Yamamoto', description: 'オーバーサイズと黒' },
  { code: 'issey', name: 'Issey Miyake', description: 'プリーツと幾何学' },
];

export const GenerationModeSelector: React.FC<GenerationModeSelectorProps> = ({
  mode,
  onModeChange,
  heritageSettings = { code: 'comme', ratio: 0.5 },
  onHeritageChange,
  zeroSettings = { code: 'comme', ratio: 0.5 },
  onZeroChange,
  mutationSettings = { constraints: [], materials: [] },
  onMutationChange,
}) => {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [mutationDeck, setMutationDeck] = useState(generateRandomMutationDeck());

  const handleModeSelect = (newMode: GenerationMode) => {
    onModeChange(newMode);
    
    // Initialize mutation deck when switching to mutation mode
    if (newMode === 'mutation' && mutationSettings.constraints.length === 0) {
      const deck = generateRandomMutationDeck();
      setMutationDeck(deck);
      onMutationChange?.(deck);
    }
  };

  const handleConstraintToggle = (constraint: string) => {
    const current = mutationSettings.constraints || [];
    const updated = current.includes(constraint)
      ? current.filter(c => c !== constraint)
      : [...current, constraint];
    onMutationChange?.({ ...mutationSettings, constraints: updated });
  };

  const handleMaterialToggle = (material: string) => {
    const current = mutationSettings.materials || [];
    const updated = current.includes(material)
      ? current.filter(m => m !== material)
      : [...current, material];
    onMutationChange?.({ ...mutationSettings, materials: updated });
  };

  const shuffleMutationDeck = () => {
    const deck = generateRandomMutationDeck();
    setMutationDeck(deck);
    onMutationChange?.(deck);
  };

  return (
    <div className="generation-mode-selector bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Mode Tabs */}
      <div className="flex space-x-2 mb-6">
        {(['simple', 'heritage', 'zero', 'mutation'] as GenerationMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeSelect(m)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              mode === m
                ? 'bg-gradient-to-r from-[#FF7A1A] to-[#FF9A4A] text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="text-sm font-bold">
              {m === 'simple' && 'Simple'}
              {m === 'heritage' && 'Heritage'}
              {m === 'zero' && 'ZERO'}
              {m === 'mutation' && 'Mutation'}
            </div>
            {mode === m && (
              <div className="text-xs mt-1 opacity-90">
                {m === 'simple' && 'シンプル'}
                {m === 'heritage' && '継承'}
                {m === 'zero' && 'ゼロ'}
                {m === 'mutation' && '変異'}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Mode Description */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">{modeDescriptions[mode]}</p>
      </div>

      {/* Mode-specific Controls */}
      <div className="mode-controls">
        {/* Heritage Mode Controls */}
        {mode === 'heritage' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                参照スタイル
              </label>
              <div className="grid grid-cols-2 gap-2">
                {heritageOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => onHeritageChange?.({ ...heritageSettings, code: option.code })}
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      heritageSettings.code === option.code
                        ? 'border-[#FF7A1A] bg-[#FF7A1A]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                継承率: {Math.round(heritageSettings.ratio * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={heritageSettings.ratio * 100}
                onChange={(e) => onHeritageChange?.({ ...heritageSettings, ratio: parseInt(e.target.value) / 100 })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>微妙に</span>
                <span>バランス</span>
                <span>強く継承</span>
              </div>
            </div>
          </div>
        )}

        {/* ZERO Mode Controls */}
        {mode === 'zero' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                回避する参照
              </label>
              <div className="grid grid-cols-2 gap-2">
                {heritageOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => onZeroChange?.({ ...zeroSettings, code: option.code })}
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      zeroSettings.code === option.code
                        ? 'border-purple-500 bg-purple-500/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500 mt-1">から離れる</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                脱参照率: {Math.round(zeroSettings.ratio * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={zeroSettings.ratio * 100}
                onChange={(e) => onZeroChange?.({ ...zeroSettings, ratio: parseInt(e.target.value) / 100 })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>少し離れる</span>
                <span>中程度</span>
                <span>完全に逸脱</span>
              </div>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-700">
                <Icons.AlertCircle className="inline w-3 h-3 mr-1" />
                ZEROモードは既知のパターンを意図的に回避し、新しい構造論理を探求します
              </p>
            </div>
          </div>
        )}

        {/* Mutation Mode Controls */}
        {mode === 'mutation' && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  制約カード（3枚選択）
                </label>
                <button
                  onClick={shuffleMutationDeck}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <Icons.Shuffle className="inline w-3 h-3 mr-1" />
                  シャッフル
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {mutationDeck.constraints.map((constraint) => {
                  const info = getConstraintInfo(constraint);
                  const isSelected = mutationSettings.constraints.includes(constraint);
                  return (
                    <button
                      key={constraint}
                      onClick={() => handleConstraintToggle(constraint)}
                      className={`p-3 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">
                        {info?.category === 'form' && '形態'}
                        {info?.category === 'structure' && '構造'}
                        {info?.category === 'visual' && '視覚'}
                      </div>
                      <div className="text-xs text-gray-600 leading-tight">
                        {constraint.replace(/_/g, ' ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                素材カード（2枚選択）
              </label>
              <div className="grid grid-cols-2 gap-2">
                {mutationDeck.materials.map((material) => {
                  const info = getMaterialInfo(material);
                  const isSelected = mutationSettings.materials.includes(material);
                  return (
                    <button
                      key={material}
                      onClick={() => handleMaterialToggle(material)}
                      className={`p-3 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">
                        {info?.category === 'textile' && '繊維'}
                        {info?.category === 'bio' && 'バイオ'}
                        {info?.category === 'treatment' && '加工'}
                        {info?.category === 'experimental' && '実験'}
                      </div>
                      <div className="text-xs text-gray-600 leading-tight">
                        {material.replace(/_/g, ' ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-700">
                <Icons.Sparkles className="inline w-3 h-3 mr-1" />
                選択した制約と素材が設計の中心になります
              </p>
            </div>
          </div>
        )}

        {/* Simple Mode */}
        {mode === 'simple' && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              通常のチャットモードです。自由にプロンプトを入力してデザインを生成します。
            </p>
          </div>
        )}
      </div>

      {/* Novelty Indicator (preview) */}
      {mode !== 'simple' && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>予想新規性:</span>
            <div className="flex items-center space-x-2">
              {mode === 'heritage' && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                  ~0.3-0.5
                </span>
              )}
              {mode === 'zero' && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  ~0.6-0.9
                </span>
              )}
              {mode === 'mutation' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  ~0.5-0.8
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationModeSelector;