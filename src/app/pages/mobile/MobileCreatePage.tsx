import React, { useState, useEffect, useRef } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { buildPrompt, type Answers } from '../../../lib/prompt/buildMobile';
import { supabase } from '../../lib/supabase';
import MetaballsSoft, { MetaballsSoftHandle } from '../../../components/MetaballsSoft';
import GlassRevealCanvas from '../../../components/GlassRevealCanvas';
import './MobileCreatePage.css';

interface MobileCreatePageProps {
  onNavigate?: (page: string) => void;
  onPublishRequest?: (imageUrl: string, generationData: any) => void;
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

type Stage = "idle" | "generating" | "revealing";

export function MobileCreatePage({ onNavigate, onPublishRequest }: MobileCreatePageProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [showButtons, setShowButtons] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const metaballRef = useRef<MetaballsSoftHandle>(null);

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

  const handleSelect = (option: string) => {
    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

    console.log('Selected:', { questionId, option, currentAnswers });

    // メタボールにインパクトをトリガー
    metaballRef.current?.triggerImpact();

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

    // 色変更 + インパクト
    metaballRef.current?.changePalette();

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

  const handleReset = () => {
    setCurrentStep(0);
    setAnswers({});
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
        let errorMessage = '生成に失敗しました';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // JSONパースに失敗した場合はステータステキストを使用
          errorMessage = `${errorMessage} (${res.status}: ${res.statusText})`;
        }
        throw new Error(errorMessage);
      }

      let responseData;
      try {
        responseData = await res.json();
      } catch (e) {
        throw new Error('サーバーからの応答が不正です。APIサーバーが起動しているか確認してください。');
      }

      const { id, url, status } = responseData;
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
    console.log('[MobileCreatePage] handleRevealDone called - showing buttons');
    setShowButtons(true);
  };

  const handlePublish = () => {
    console.log('[MobileCreatePage] handlePublish called - navigating to publishForm');
    if (imageUrl && onPublishRequest) {
      // 公開フォームページに画像URLと生成データを渡す
      onPublishRequest(imageUrl, { answers });
    } else {
      // フォールバック
      onNavigate?.('gallery');
    }
  };

  const handleSaveDraft = () => {
    console.log('[MobileCreatePage] handleSaveDraft called - navigating to mypage');
    // TODO: ドラフト保存処理
    // マイページのDraftsタブに保存
    onNavigate?.('mypage');
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
              <div className="create-hero">
                <div className="create-hero__canvas">
                  <MetaballsSoft ref={metaballRef} animated={true} />
                </div>
                <div className="create-hero__title">
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

              {/* Progress bar */}
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-text">
                  {currentStep + 1} / {createQuestions.length}
                </p>
              </div>

              {/* Navigation */}
              <div className="nav-buttons">
                <button
                  className="nav-btn primary"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {currentStep === createQuestions.length - 1 ? '生成する' : '次へ'}
                </button>
              </div>

              {/* 設問2以降のリセット・戻るボタン */}
              {currentStep >= 1 && (
                <div className="secondary-nav-buttons">
                  <button className="reset-btn" onClick={handleReset}>
                    はじめからやり直す
                  </button>
                  <button className="back-btn" onClick={handleBack}>
                    一つ前に戻る
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 画像コンテナ - 横幅いっぱいに表示 */}
              <div className="viewer-container" style={{ position: 'relative', width: 'calc(100% + 40px)', aspectRatio: '3/4', marginTop: '32px', marginBottom: '24px', marginLeft: '-20px', marginRight: '-20px' }}>
                {/* 生成中のProcedural（フェードアウト可能） */}
                {stage === "generating" && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 16,
                      overflow: 'hidden',
                      zIndex: 1
                    }}
                  >
                    <MetaballsSoft animated={true} />
                  </div>
                )}

                {/* メタボールフェードアウト用オーバーレイ */}
                {stage === "revealing" && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 16,
                      overflow: 'hidden',
                      zIndex: 1,
                      opacity: 1,
                      animation: 'fadeOut 0.4s ease-out forwards'
                    }}
                  >
                    <MetaballsSoft animated={true} />
                  </div>
                )}

                {/* 受信後の"Glass Stripe Reveal" → 完成品表示（同じCanvas） */}
                {stage === "revealing" && imageUrl && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', zIndex: 2 }}>
                    <GlassRevealCanvas
                      imageUrl={imageUrl}
                      showButtons={showButtons}
                      onRevealDone={handleRevealDone}
                      onPublish={handlePublish}
                      onSaveDraft={handleSaveDraft}
                      stripes={48}
                      jitter={0.08}
                      strength={0.9}
                      holdMs={3000}
                      revealMs={1200}
                      leftToRight={true}
                      active={true}
                    />
                  </div>
                )}
              </div>

              {/* テキスト表示エリア（画像の下） */}
              {stage === "generating" && (
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontFamily: "'Trajan Pro', serif", fontSize: 20, fontWeight: 300, letterSpacing: '0.1em', color: '#000', marginBottom: 8 }}>
                    PLEASE WAIT
                  </div>
                  <div style={{ fontFamily: "'Noto Sans CJK JP', 'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 300, color: '#666' }}>
                    お待ちください
                  </div>
                </div>
              )}

              {stage === "revealing" && !showButtons && (
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontFamily: "'Trajan Pro', serif", fontSize: 20, fontWeight: 300, letterSpacing: '0.1em', color: '#000', marginBottom: 8 }}>
                    PLEASE WAIT
                  </div>
                  <div style={{ fontFamily: "'Noto Sans CJK JP', 'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 300, color: '#666' }}>
                    お待ちください
                  </div>
                </div>
              )}

              {stage === "revealing" && showButtons && (
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontFamily: "'Trajan Pro', serif", fontSize: 20, fontWeight: 300, letterSpacing: '0.1em', color: '#000', marginBottom: 8 }}>
                    PERFECT
                  </div>
                  <div style={{ fontFamily: "'Noto Sans CJK JP', 'Noto Sans JP', sans-serif", fontSize: 14, fontWeight: 300, color: '#666' }}>
                    世界でひとつのデザインが出来上がりました
                  </div>
                </div>
              )}
            </>
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
