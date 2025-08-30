import { useEffect, useState } from 'react';
import { Icons } from './Icons';

interface GenerationProgressProps {
  isGenerating: boolean;
  progress?: number;
}

export function GenerationProgress({ isGenerating, progress }: GenerationProgressProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (!isGenerating) {
      setDisplayProgress(0);
      return;
    }

    // Simulate progress if not provided
    if (progress === undefined) {
      const interval = setInterval(() => {
        setDisplayProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 5;
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      setDisplayProgress(progress);
    }
  }, [isGenerating, progress]);

  useEffect(() => {
    if (!isGenerating) {
      setStatusText('');
      return;
    }

    const messages = [
      'プロンプトを解析中...',
      'デザインコンセプトを生成中...',
      'スタイルを適用中...',
      '細部を調整中...',
      '最終仕上げ中...'
    ];

    let currentIndex = 0;
    setStatusText(messages[0]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      setStatusText(messages[currentIndex]);
    }, 2000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isGenerating) return null;

  return (
    <div className="card p-4 mx-auto max-w-md">
      <div className="flex items-center gap-3">
        {/* Animated icon */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full bg-accent bg-opacity-20 animate-ping"></div>
          <div className="relative w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white">
            <Icons.Palette size={16} />
          </div>
        </div>

        <div className="flex-1">
          {/* Status text */}
          <p className="text-sm font-medium text-ink-900 mb-2">{statusText}</p>
          
          {/* Progress bar */}
          <div className="w-full bg-ink-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-accent to-accent/80 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(displayProgress, 100)}%` }}
            />
          </div>
          
          {/* Progress percentage */}
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-ink-400">生成中...</span>
            <span className="text-xs font-medium text-accent">
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Estimated time */}
      <div className="mt-3 pt-3 border-t border-ink-200">
        <p className="text-xs text-ink-400 text-center">
          通常1〜2分で完了します
        </p>
      </div>
    </div>
  );
}