import { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface ProgressStep {
  id: string;
  label: string;
  description: string;
  duration: number; // 表示時間（ミリ秒）
  status: 'pending' | 'active' | 'completed';
}

interface EnhancedGenerationProgressProps {
  isGenerating: boolean;
  currentStep?: string;
  progress?: number;
}

export function EnhancedGenerationProgress({ 
  isGenerating, 
  currentStep: _currentStep,
  progress = 0
}: EnhancedGenerationProgressProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const steps: ProgressStep[] = [
    {
      id: 'analyze',
      label: 'スタイル分析',
      description: 'あなたの選択を分析しています...',
      duration: 3000,
      status: 'pending'
    },
    {
      id: 'prompt',
      label: 'プロンプト生成',
      description: 'AIが最適なプロンプトを作成しています...',
      duration: 4000,
      status: 'pending'
    },
    {
      id: 'queue',
      label: '生成キュー',
      description: '生成サーバーに送信しています...',
      duration: 2000,
      status: 'pending'
    },
    {
      id: 'generate',
      label: 'デザイン生成',
      description: 'ファッションデザインを生成中...',
      duration: 45000, // 45秒
      status: 'pending'
    },
    {
      id: 'process',
      label: '最終処理',
      description: '生成結果を処理しています...',
      duration: 3000,
      status: 'pending'
    }
  ];

  useEffect(() => {
    if (!isGenerating) {
      setActiveStepIndex(0);
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;

    let cumulativeTime = 0;
    let targetStepIndex = 0;

    for (let i = 0; i < steps.length; i++) {
      cumulativeTime += steps[i].duration;
      if (elapsedTime < cumulativeTime) {
        targetStepIndex = i;
        break;
      }
      targetStepIndex = steps.length - 1; // 最後のステップ
    }

    setActiveStepIndex(targetStepIndex);
  }, [elapsedTime, isGenerating]);

  if (!isGenerating) return null;

  const currentStepData = steps[activeStepIndex];
  const progressPercent = Math.min(progress || (elapsedTime / 60000) * 100, 100);

  return (
    <div className="card p-6 max-w-md mx-auto">
      {/* メインプログレスバー */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-ink-900">デザイン生成中</h3>
          <span className="text-sm text-ink-500">{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full bg-ink-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 現在のステップ */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <Icons.Sparkles className="text-white" size={16} />
          </div>
          <div>
            <div className="font-medium text-ink-900">{currentStepData.label}</div>
            <div className="text-sm text-ink-600">{currentStepData.description}</div>
          </div>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
              index === activeStepIndex ? 'bg-accent bg-opacity-10' : ''
            }`}
          >
            <div className={`w-2 h-2 rounded-full transition-colors ${
              index < activeStepIndex ? 'bg-green-500' : 
              index === activeStepIndex ? 'bg-accent animate-pulse' : 
              'bg-ink-200'
            }`} />
            <span className={`text-sm ${
              index === activeStepIndex ? 'text-accent font-medium' : 
              index < activeStepIndex ? 'text-green-600' : 
              'text-ink-400'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* 推定残り時間 */}
      <div className="mt-4 pt-4 border-t border-ink-200">
        <div className="text-center">
          <div className="text-xs text-ink-400">推定残り時間</div>
          <div className="text-sm font-medium text-ink-600">
            {activeStepIndex >= steps.length - 1 ? 'まもなく完了' : `約${Math.max(1, Math.ceil((60 - elapsedTime / 1000) / 60))}分`}
          </div>
        </div>
      </div>

      {/* 励ましメッセージ */}
      <div className="mt-4 text-center">
        <div className="text-xs text-ink-500">
          {progressPercent < 30 ? '✨ あなただけの特別なデザインを準備しています' :
           progressPercent < 70 ? '🎨 クリエイティブなアイデアを形にしています' :
           '🌟 もうすぐ完成です！'}
        </div>
      </div>
    </div>
  );
}