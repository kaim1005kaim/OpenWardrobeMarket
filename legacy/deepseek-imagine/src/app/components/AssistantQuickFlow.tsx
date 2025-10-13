import { useState } from 'react';

interface QuickFlowAnswer {
  vibe: string;
  fit: string;
  palette: string;
}

interface AssistantQuickFlowProps {
  onDone: (answers: QuickFlowAnswer) => void;
  onStepChange?: (step: number, answer: Partial<QuickFlowAnswer>) => void;
}

export function AssistantQuickFlow({ onDone, onStepChange }: AssistantQuickFlowProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [answers, setAnswers] = useState<Partial<QuickFlowAnswer>>({});

  const next = () => setStep((s) => (s < 2 ? ((s + 1) as any) : s));
  
  const select = (key: keyof QuickFlowAnswer, value: string) => {
    console.log('[AssistantQuickFlow] Select:', { key, value, step });
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);
    
    // 選択時のコールバック
    onStepChange?.(step, newAnswers);
    
    if (step < 2) {
      console.log('[AssistantQuickFlow] Moving to next step');
      setTimeout(() => next(), 500); // 少し遅延を入れて反応を見せる
    } else {
      console.log('[AssistantQuickFlow] Completing flow', newAnswers);
      setTimeout(() => onDone(newAnswers as QuickFlowAnswer), 800);
    }
  };

  const steps = [
    {
      question: "どんな雰囲気で作る？",
      key: 'vibe' as const,
      options: ['ミニマル', 'ストリート', 'カジュアル', 'エレガント', 'ロマンチック', 'モード', 'スポーティ', 'ナチュラル']
    },
    {
      question: "シルエットは？",
      key: 'fit' as const,
      options: ['オーバーサイズ', 'テーラード', 'スリム', 'ストレート', 'クロップド', 'ワイド', 'フィット', 'リラックス']
    },
    {
      question: "カラーパレットは？",
      key: 'palette' as const,
      options: ['ニュートラル', 'モノクロ', 'アースカラー', 'パステル', 'ビビッド', 'デニム', 'ダーク', 'ブライト']
    }
  ];

  return (
    <div className="card p-4">
      {/* Progress indicators */}
      <div className="flex gap-2 mb-3">
        {steps.map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= step ? 'bg-accent' : 'bg-ink-200'
            }`}
          />
        ))}
      </div>

      {/* Current question */}
      <div className="mb-3">
        <p className="text-sm text-ink-700 mb-3">{steps[step].question}</p>
        <div className="flex gap-2 flex-wrap">
          {steps[step].options.map((option) => (
            <button
              key={option}
              className="chip"
              onClick={() => select(steps[step].key, option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Previous selections summary */}
      {step > 0 && (
        <div className="text-xs text-ink-400 pt-2 border-t border-ink-200">
          {answers.vibe && <span className="inline-block bg-ink-100 rounded px-2 py-1 mr-2">雰囲気: {answers.vibe}</span>}
          {answers.fit && <span className="inline-block bg-ink-100 rounded px-2 py-1 mr-2">シルエット: {answers.fit}</span>}
        </div>
      )}
    </div>
  );
}