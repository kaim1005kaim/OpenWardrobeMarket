import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { buildPrompt, type Answers } from '../../../lib/prompt/buildMobile';
import { supabase } from '../../lib/supabase';
import MetaballsSoft, { MetaballsSoftHandle } from '../../../components/MetaballsSoft';
import GlassRevealCanvas from '../../../components/GlassRevealCanvas';
import './MobileCreatePage.css';

// --- DNA and Sync Logic from Design Document ---

export type DNA = {
  hue: number;      // 0..1
  sat: number;      // 0..1
  light: number;    // 0..1
  minimal_maximal: number;   // -1..1
  street_luxury: number;     // -1..1
  oversized_fitted: number;  // -1..1
  relaxed_tailored: number;  // -1..1
  texture: number;  // 0..1
};

const initialDNA: DNA = {
  hue: 0.56, sat: 0.25, light: 0.62, minimal_maximal: -0.2,
  street_luxury: 0, oversized_fitted: 0, relaxed_tailored: 0, texture: 0.3
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dnaReducer(state: DNA, action: {type:'set'|'delta'; key?: keyof DNA; value?: number; delta?: number}) {
  if (action.type === 'set' && action.key) return {...state, [action.key]: action.value!};
  if (action.type === 'delta' && action.key) return {...state, [action.key]: clamp(state[action.key] + (action.delta||0), -1, 1)};
  return state;
}

function useDNASync(sessionKey: string, getPayload: () => {
  answers:any; freeText?:string; dna:DNA; geminiTags?:any; promptPreview?:string;
}) {
  const queue = useRef<any>(null);
  const timer = useRef<number|undefined>();

  const checkpoint = useCallback(() => {
    if (!sessionKey) return;
    queue.current = getPayload();
    if (timer.current) return;
    timer.current = window.setTimeout(async () => {
      const payload = queue.current; queue.current = null; timer.current = undefined;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await fetch('/api/dna-sync', { 
        method:'POST', 
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Bearer ${token}`
        }, 
        body: JSON.stringify({sessionKey, ...payload}) 
      });
    }, 1200); // 1.2s
  }, [sessionKey, getPayload]);

  const flushNow = useCallback(async () => {
    const payload = queue.current ?? getPayload();
    queue.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = undefined; }
    if (!sessionKey || !payload) return;

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    await fetch('/api/dna/sync', { 
      method:'POST', 
      headers:{
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token}`
      }, 
      body: JSON.stringify({sessionKey, ...payload}) 
    });
  }, [sessionKey, getPayload]);

  return { checkpoint, flushNow };
}

// --- Component Interfaces and Constants ---

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

// --- Main Component ---

export function MobileCreatePage({ onNavigate, onPublishRequest }: MobileCreatePageProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [showButtons, setShowButtons] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const metaballRef = useRef<MetaballsSoftHandle>(null);

  // DNA State Management
  const [dna, dispatchDNA] = useReducer(dnaReducer, initialDNA);
  const [sessionKey, setSessionKey] = useState(() => `mobile-create-${Date.now()}`);

  // DNA Sync Logic
  const getPayload = useCallback(() => ({
    answers,
    dna,
    // freeText, geminiTags, promptPreview can be added later
  }), [answers, dna]);
  const { checkpoint, flushNow } = useDNASync(sessionKey, getPayload);

  const currentQuestion = createQuestions[currentStep];
  const progress = ((currentStep + 1) / createQuestions.length) * 100;

  const handleSelect = (option: string) => {
    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

    metaballRef.current?.triggerImpact();

    let newAnswers: Record<string, string[]>;
    if (currentQuestion.multiSelect) {
      if (currentAnswers.includes(option)) {
        newAnswers = { ...answers, [questionId]: currentAnswers.filter(a => a !== option) };
      } else {
        newAnswers = { ...answers, [questionId]: [...currentAnswers, option] };
      }
    } else {
      newAnswers = { ...answers, [questionId]: [option] };
    }
    setAnswers(newAnswers);
    checkpoint(); // Save on interaction
  };

  const isSelected = (option: string) => {
    return (answers[currentQuestion.id] || []).includes(option);
  };

  const canProceed = () => {
    return (answers[currentQuestion.id] || []).length > 0;
  };

  const handleNext = () => {
    checkpoint(); // Save on step change
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
    dispatchDNA({ type: 'set', key: 'hue', value: initialDNA.hue }); // Reset DNA
    setSessionKey(`mobile-create-${Date.now()}`); // Start new session
  };

  const handleGenerate = async () => {
    await flushNow(); // Force sync before generating

    setStage("generating");
    setIsGenerating(true);

    try {
      const answersData: Answers = {
        vibe: answers.vibe || [],
        silhouette: answers.silhouette || [],
        color: answers.color || [],
        occasion: answers.occasion || [],
        season: answers.season || [],
      };

      const prompt = buildPrompt(answersData);
      const negative = "no text, no words, no logos, no brands, no celebrities, no multiple people, no watermark, no signature";

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('ログインが必要です');

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
          dna: dna, // Pass DNA to API
        }),
      });

      if (!res.ok) {
        let errorMessage = '生成に失敗しました';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage} (${res.status}: ${res.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await res.json();
      const { url } = responseData;

      if (url) {
        setImageUrl(url);
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
    setShowButtons(true);
  };

  const handlePublish = () => {
    if (imageUrl && onPublishRequest) {
      onPublishRequest(imageUrl, { answers, dna });
    } else {
      onNavigate?.('gallery');
    }
  };

  const handleSaveDraft = () => {
    onNavigate?.('mypage');
  };

  const handleMenuNavigate = (page: string) => {
    onNavigate?.(page);
  };

  // ... JSX remains largely the same ...
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
