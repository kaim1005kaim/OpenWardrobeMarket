import React, { useState, useEffect } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { buildPrompt, type Answers } from '../../../lib/prompt/buildMobile';
import { supabase } from '../../lib/supabase';
import BlobGlassCanvas from '../../../components/BlobGlassCanvas';
import GlassRevealCanvas from '../../../components/GlassRevealCanvas';
import QuestionBlobCanvas from '../../../components/QuestionBlobCanvas';
import { getMorphConfig } from '../../../lib/questionMorphing';
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

type Stage = "idle" | "generating" | "revealing" | "done";

export function MobileCreatePage({ onNavigate }: MobileCreatePageProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // 設問アニメーション用
  const [morphType, setMorphType] = useState(0);
  const [colorA, setColorA] = useState("#F4DDD4");
  const [colorB, setColorB] = useState("#D4887A");
  const [transition, setTransition] = useState(0);

  const currentQuestion = createQuestions[currentStep];
  const progress = ((currentStep + 1) / createQuestions.length) * 100;

  // 各ステップごとの色パレット（生成中用）
  const PALETTES = [
    { a: "#F5D4C7", b: "#D86C56" }, // step1 (vibe)
    { a: "#D7E8FF", b: "#6BA4FF" }, // step2 (silhouette)
    { a: "#E9DDFF", b: "#8A63F8" }, // step3 (color) 紫寄り
    { a: "#D9F0E5", b: "#33A68B" }, // step4 (occasion)
    { a: "#FFF1C7", b: "#E0A33A" }, // step5 (season)
  ];

  const currentPalette = PALETTES[Math.min(currentStep, PALETTES.length - 1)];

  // 回答が変更されたら形状と色を更新
  useEffect(() => {
    const config = getMorphConfig(answers);
    setMorphType(config.morphType);
    setColorA(config.colorA);
    setColorB(config.colorB);

    // トランジションアニメーション
    setTransition(0);
    const timer = setTimeout(() => setTransition(1), 50);
    return () => clearTimeout(timer);
  }, [answers]);

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
    setStage("generating");
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
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/api/nano-generate`, {
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

      const { id, url, status } = await res.json();
      console.log('Generation completed:', { id, url, status });

      // Nano Bananaは同期処理なので即座にURLが返る
      if (url) {
        setImageUrl(url);
        setGenerationProgress(100);
        setStage("revealing");
      } else {
        throw new Error('画像URLが取得できませんでした');
      }

    } catch (error) {
      console.error('Generation error:', error);
      alert(error instanceof Error ? error.message : '生成に失敗しました');
      setStage("idle");
      setIsGenerating(false);
    }
  };

  const handleRevealDone = () => {
    setStage("done");
    // isGenerating は done 状態でも true のままにして、生成完了画面を表示
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
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="create-logo-btn" onClick={() => onNavigate?.('home')}>OWM</button>
      </header>

      <div className="create-content">
          {!isGenerating ? (
            <>
              {/* CREATEタイトル + 設問アニメーション */}
              <div style={{ position: 'relative', width: '100%', height: '320px', marginTop: '0', marginBottom: '32px' }}>
                {/* アニメーション背景 */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden' }}>
                  <QuestionBlobCanvas
                    active={!isGenerating}
                    morphType={morphType}
                    colorA={colorA}
                    colorB={colorB}
                    transition={transition}
                  />
                </div>
                {/* CREATEタイトル（エフェクトの上に重ねる） */}
                <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <h1 className="create-title">CREATE</h1>
                </div>
              </div>

              {/* Question */}
              <div className="question-container">
                <h2 className="question-text">{currentQuestion.question}</h2>
                {currentQuestion.multiSelect && (
                  <p className="hint-text">複数選択可能です</p>
                )}
              </div>

              {/* Progress bar */}
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-text">
                  {currentStep + 1} / {createQuestions.length}
                </p>
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
            <div className="viewer-container" style={{ position: 'relative', width: '100%', aspectRatio: '3/4', marginTop: '32px' }}>
              {/* 生成中のProcedural */}
              {stage === "generating" && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', zIndex: 1 }}>
                  <BlobGlassCanvas
                    active={stage === "generating"}
                    maskFeather={0.1}
                    targetA={currentPalette.a}
                    targetB={currentPalette.b}
                    psScale={0.82}
                    psSmooth={0.6}
                    psDistort={0.90}
                  />
                  <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', color: '#666', fontSize: 14 }}>
                    PLEASE WAIT<br />生成中です…
                  </div>
                </div>
              )}

              {/* 受信後の"歪ませリビール" */}
              {stage === "revealing" && imageUrl && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', zIndex: 2 }}>
                  <GlassRevealCanvas
                    imageUrl={imageUrl}
                    durationMs={2500}
                    amount={0.08}
                    glassScale={[12, 1]}
                    glassRotate={0}
                    maskFeather={0}
                    active={stage === "revealing"}
                    onDone={handleRevealDone}
                  />
                </div>
              )}

              {/* 完成表示 */}
              {stage === "done" && imageUrl && (
                <>
                  <img
                    src={imageUrl}
                    alt="generated"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }}
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, display: 'flex', gap: 12 }}>
                    <button
                      style={{ flex: 1, padding: '12px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => alert('ドラフト保存機能は実装予定です')}
                    >
                      ドラフトに保存
                    </button>
                    <button
                      style={{ flex: 1, padding: '12px 16px', background: '#000', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => onNavigate?.('mypage')}
                    >
                      公開する
                    </button>
                  </div>
                </>
              )}
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
