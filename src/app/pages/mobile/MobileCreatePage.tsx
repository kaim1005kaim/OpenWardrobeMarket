import React, { useState } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { buildPrompt, type Answers } from '../../../lib/prompt/buildMobile';
import { supabase } from '../../lib/supabase';
import './MobileCreatePage.css';

interface MobileCreatePageProps {
  onNavigate?: (page: string) => void;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  multiSelect?: boolean;
}

const createQuestions: Question[] = [
  {
    id: 'vibe',
    question: 'どんな雰囲気のデザインにしたいですか？',
    options: ['minimal', 'street', 'luxury', 'outdoor', 'workwear', 'athleisure'],
  },
  {
    id: 'silhouette',
    question: 'シルエットはどうしますか？',
    options: ['oversized', 'fitted', 'loose', 'tailored', 'relaxed'],
  },
  {
    id: 'color',
    question: 'カラーパレットを選択してください',
    options: ['black', 'white', 'navy', 'earth', 'pastel', 'neon', 'monochrome'],
    multiSelect: true,
  },
  {
    id: 'occasion',
    question: '着用シーンは？',
    options: ['casual', 'business', 'formal', 'sports', 'outdoor'],
  },
  {
    id: 'season',
    question: 'シーズンは？',
    options: ['spring/summer', 'autumn/winter', 'resort', 'all season'],
  },
];

export function MobileCreatePage({ onNavigate }: MobileCreatePageProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const currentQuestion = createQuestions[currentStep];
  const progress = ((currentStep + 1) / createQuestions.length) * 100;

  const handleSelect = (option: string) => {
    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

    console.log('Selected:', { questionId, option, currentAnswers });

    if (currentQuestion.multiSelect) {
      // Multi-select: toggle
      if (currentAnswers.includes(option)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter(a => a !== option),
        });
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, option],
        });
      }
    } else {
      // Single select: replace
      const newAnswers = {
        ...answers,
        [questionId]: [option],
      };
      console.log('New answers:', newAnswers);
      setAnswers(newAnswers);
    }
  };

  const isSelected = (option: string) => {
    const currentAnswers = answers[currentQuestion.id] || [];
    return currentAnswers.includes(option);
  };

  const canProceed = () => {
    const currentAnswers = answers[currentQuestion.id] || [];
    const result = currentAnswers.length > 0;
    console.log('canProceed:', { questionId: currentQuestion.id, currentAnswers, result });
    return result;
  };

  const handleNext = () => {
    console.log('handleNext called, currentStep:', currentStep, 'answers:', answers);
    if (currentStep < createQuestions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    console.log('Generating with answers:', answers);

    try {
      // プロンプト生成
      const answersData: Answers = {
        vibe: answers.vibe || [],
        silhouette: answers.silhouette || [],
        color: answers.color || [],
        occasion: answers.occasion || [],
        season: answers.season || [],
      };

      const prompt = buildPrompt(answersData);
      const negative = "no text, no words, no logos, no brands, no celebrities, no multiple people, no watermark, no signature";

      // 認証トークン取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('ログインが必要です');
      }

      // Nano Banana API呼び出し
      const res = await fetch('/api/nano-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          negative,
          aspectRatio: '3:4',
          answers: answersData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '生成に失敗しました');
      }

      const { id, taskId, status } = await res.json();
      console.log('Generation started:', { id, taskId, status });

      // Supabaseのリアルタイム更新を監視
      setGenerationStatus('生成開始...');

      // デバッグ用：定期的にデータベースをポーリング
      const pollInterval = setInterval(async () => {
        const { data: historyData } = await supabase
          .from('generation_history')
          .select('*')
          .eq('id', id)
          .single();

        console.log('Polling generation_history:', historyData);

        // UIを更新
        if (historyData) {
          // 進捗更新
          if (historyData.generation_data?.progress) {
            setGenerationProgress(historyData.generation_data.progress);
            setGenerationStatus(`生成中... ${historyData.generation_data.progress}%`);
          }

          // プレビュー画像更新
          if (historyData.generation_data?.preview_url) {
            setPreviewUrl(historyData.generation_data.preview_url);
          }

          // 完了チェック
          if (historyData.completion_status === 'completed' && historyData.image_url) {
            clearInterval(pollInterval);
            setGenerationStatus('生成完了！');
            setGenerationProgress(100);
            setTimeout(() => {
              alert('生成完了！マイページで確認できます。');
              if (onNavigate) {
                onNavigate('mypage');
              }
            }, 1000);
          }

          // 失敗チェック
          if (historyData.completion_status === 'failed') {
            clearInterval(pollInterval);
            setGenerationStatus('生成失敗');
            alert('生成に失敗しました。もう一度お試しください。');
            setIsGenerating(false);
          }
        }
      }, 3000);

      const channel = supabase
        .channel(`generation-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'generation_history',
            filter: `id=eq.${id}`,
          },
          (payload) => {
            console.log('Generation update:', payload);
            const newRow = payload.new as any;

            // 進捗更新
            if (newRow.generation_data?.progress) {
              setGenerationProgress(newRow.generation_data.progress);
              setGenerationStatus(`生成中... ${newRow.generation_data.progress}%`);
            }

            // プレビュー画像更新
            if (newRow.generation_data?.preview_url) {
              setPreviewUrl(newRow.generation_data.preview_url);
            }

            // 完了チェック
            if (newRow.completion_status === 'completed' && newRow.image_url) {
              setGenerationStatus('生成完了！');
              setGenerationProgress(100);

              setTimeout(() => {
                alert('生成完了！マイページで確認できます。');
                if (onNavigate) {
                  onNavigate('mypage');
                }
              }, 1000);
            }

            // エラーチェック
            if (newRow.completion_status === 'failed') {
              setGenerationStatus('生成失敗');
              alert('生成に失敗しました。もう一度お試しください。');
              setIsGenerating(false);
            }
          }
        )
        .subscribe();

      // クリーンアップ用にタイムアウト設定（5分）
      setTimeout(() => {
        channel.unsubscribe();
        if (isGenerating) {
          setGenerationStatus('タイムアウト');
          alert('生成に時間がかかっています。マイページで確認してください。');
          setIsGenerating(false);
        }
      }, 300000);

    } catch (error) {
      console.error('Generation error:', error);
      alert(error instanceof Error ? error.message : '生成に失敗しました');
      setIsGenerating(false);
    }
  };

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <div className="mobile-create-page">
      {/* Header */}
      <header className="create-header">
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="create-logo">CREATE</div>
      </header>

      <div className="create-content">
          {/* Progress bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="progress-text">
              {currentStep + 1} / {createQuestions.length}
            </p>
          </div>

          {!isGenerating ? (
            <>
              {/* Question */}
              <div className="question-container">
                <h2 className="question-text">{currentQuestion.question}</h2>
                {currentQuestion.multiSelect && (
                  <p className="hint-text">複数選択可能です</p>
                )}
              </div>

              {/* Options */}
              <div className="options-container">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    className={`option-btn ${isSelected(option) ? 'selected' : ''}`}
                    onClick={() => handleSelect(option)}
                  >
                    <span className="option-check">
                      {isSelected(option) && '✓'}
                    </span>
                    <span className="option-label">{option}</span>
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="nav-buttons">
                {currentStep > 0 && (
                  <button className="nav-btn secondary" onClick={handleBack}>
                    戻る
                  </button>
                )}
                <button
                  className="nav-btn primary"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {currentStep === createQuestions.length - 1 ? '生成する' : '次へ'}
                </button>
              </div>
            </>
          ) : (
            <div className="generating-container">
              {previewUrl && (
                <div className="preview-image-container">
                  <img src={previewUrl} alt="生成プレビュー" className="preview-image" />
                </div>
              )}
              <div className="spinner"></div>
              <p className="generating-text">{generationStatus || 'デザインを生成中...'}</p>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${generationProgress}%` }}></div>
              </div>
              <p className="progress-percentage">{generationProgress}%</p>
            </div>
          )}
      </div>

      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />
    </div>
  );
}
