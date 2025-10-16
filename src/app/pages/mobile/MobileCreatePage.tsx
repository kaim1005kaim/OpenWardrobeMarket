import React, { useState, useEffect, useRef } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { supabase } from '../../lib/supabase';
import MetaballsSoft, { MetaballsSoftHandle } from '../../../components/MetaballsSoft';
import GlassRevealCanvas from '../../../components/GlassRevealCanvas';
import { useDisplayImage } from '../../../hooks/useDisplayImage';
import { useDNA } from '../../../hooks/useDNA';
import { DEFAULT_DNA, type DNA, type Answers, type GeminiCoachOut } from '../../../types/dna';
import { COPY } from '../../../constants/copy';
import './MobileCreatePage.css';

// Helper: Base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

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
    question: COPY.questions.vibe,
    options: ['ミニマル', 'ストリート', 'ラグジュアリー', 'アウトドア', 'ワークウェア', 'アスレジャー'],
  },
  {
    id: 'silhouette',
    question: COPY.questions.silhouette,
    options: ['オーバーサイズ', 'フィット', 'ルーズ', 'テーラード', 'リラックス', 'スリム'],
  },
  {
    id: 'color',
    question: COPY.questions.color,
    options: ['ブラック', 'ホワイト', 'ネイビー', 'アースカラー', 'パステル', 'ネオン', 'モノトーン', 'ビビッド'],
    multiSelect: true,
  },
  {
    id: 'occasion',
    question: COPY.questions.occasion,
    options: ['カジュアル', 'ビジネス', 'フォーマル', 'スポーツ', 'アウトドア', 'リゾート'],
  },
  {
    id: 'season',
    question: COPY.questions.season,
    options: ['春夏', '秋冬', 'リゾート', 'オールシーズン'],
  },
];

type Stage = 'answering' | 'coaching' | 'preview' | 'generating' | 'revealing' | 'done';

export function MobileCreatePage({ onNavigate }: MobileCreatePageProps) {
  const [stage, setStage] = useState<Stage>('answering');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [freeText, setFreeText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // DNA management
  const sessionKey = useRef(`mobile-create-${Date.now()}`).current;
  const { dna, updateDNA, syncNow, updateContext } = useDNA(sessionKey, DEFAULT_DNA);
  const metaballsRef = useRef<MetaballsSoftHandle>(null);

  // Coaching state
  const [coachData, setCoachData] = useState<GeminiCoachOut | null>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);

  // Generation state
  const [generatedAsset, setGeneratedAsset] = useState<{
    key: string;
    blobUrl: string;
    finalUrl?: string | null;
    answers: Answers;
    dna: DNA;
    prompt: string;
    imageData?: string;
    mimeType?: string;
  } | null>(null);
  const [showButtons, setShowButtons] = useState(false);

  const { src: displayUrl } = useDisplayImage({
    blobUrl: generatedAsset?.blobUrl,
    finalUrl: generatedAsset?.finalUrl,
  });

  const currentQuestion = createQuestions[currentStep];
  const progress = ((currentStep + 1) / createQuestions.length) * 100;

  // Update DNA context when answers/freeText change
  useEffect(() => {
    const answersData: Answers = {
      vibe: answers.vibe || [],
      silhouette: answers.silhouette || [],
      color: answers.color || [],
      occasion: answers.occasion || [],
      season: answers.season || [],
    };
    updateContext({ answers: answersData, freeText });
  }, [answers, freeText, updateContext]);

  const handleSelect = (option: string) => {
    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

    metaballsRef.current?.triggerImpact();

    let newAnswers: Record<string, string[]>;
    if (currentQuestion.multiSelect) {
      if (currentAnswers.includes(option)) {
        newAnswers = { ...answers, [questionId]: currentAnswers.filter((a) => a !== option) };
      } else {
        newAnswers = { ...answers, [questionId]: [...currentAnswers, option] };
      }
    } else {
      newAnswers = { ...answers, [questionId]: [option] };
    }
    setAnswers(newAnswers);

    // Apply simple DNA delta based on selection
    applyAnswerDNA(questionId, option);
  };

  const applyAnswerDNA = (questionId: string, option: string) => {
    // Simple heuristic DNA adjustments
    const deltasMap: Record<string, Partial<DNA>> = {
      minimal: { minimal_maximal: -0.2 },
      luxury: { street_luxury: 0.2 },
      street: { street_luxury: -0.2 },
      oversized: { oversized_fitted: -0.2 },
      fitted: { oversized_fitted: 0.2 },
      tailored: { relaxed_tailored: 0.2 },
      relaxed: { relaxed_tailored: -0.2 },
    };

    const delta = deltasMap[option];
    if (delta) {
      updateDNA((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(delta).map(([k, v]) => [
            k,
            Math.max(-1, Math.min(1, (prev[k as keyof DNA] as number) + v)),
          ])
        ),
      }));
    }
  };

  const isSelected = (option: string) => {
    return (answers[currentQuestion.id] || []).includes(option);
  };

  const canProceed = () => {
    return (answers[currentQuestion.id] || []).length > 0;
  };

  const handleNext = () => {
    metaballsRef.current?.changePalette();

    if (currentStep < createQuestions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // All 5 questions answered -> go to coaching
      setStage('coaching');
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
    setFreeText('');
    setStage('answering');
    updateDNA(DEFAULT_DNA);
  };

  // Coaching: Fetch chips/ask from Gemini
  const handleCoach = async () => {
    setIsCoaching(true);

    try {
      const answersData: Answers = {
        vibe: answers.vibe || [],
        silhouette: answers.silhouette || [],
        color: answers.color || [],
        occasion: answers.occasion || [],
        season: answers.season || [],
      };

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('ログインが必要です');

      const response = await fetch('/api/gemini/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          answers: answersData,
          freeText,
          dna,
        }),
      });

      if (!response.ok) throw new Error('Coach API failed');

      const coachResult: GeminiCoachOut = await response.json();
      setCoachData(coachResult);

      // Apply coach deltas to DNA
      coachResult.deltas.forEach((delta) => {
        updateDNA((prev) => ({
          ...prev,
          [delta.key]: Math.max(-1, Math.min(1, prev[delta.key] + delta.delta)),
        }));
      });

      updateContext({ geminiTags: coachResult.tags });
    } catch (error) {
      console.error('[handleCoach] Error:', error);
      alert(COPY.errors.guidance);
    } finally {
      setIsCoaching(false);
    }
  };

  const handleChipToggle = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleAskSelect = (option: string) => {
    setAskAnswer(option);
  };

  const handlePreview = () => {
    setStage('preview');
  };

  const handleGenerate = async () => {
    await syncNow(); // Sync DNA before generation

    setStage('generating');

    try {
      const answersData: Answers = {
        vibe: answers.vibe || [],
        silhouette: answers.silhouette || [],
        color: answers.color || [],
        occasion: answers.occasion || [],
        season: answers.season || [],
      };

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('ログインが必要です');

      const token = sessionData.session.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

      // Compose prompt
      const composeRes = await fetch(`${apiUrl}/api/prompt/compose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: answersData,
          dna,
          chipsChosen: selectedChips,
          askAnswers: askAnswer ? { [coachData?.ask?.id || 'ask']: askAnswer } : {},
          freeTextTags: freeText ? [freeText] : [],
        }),
      });

      if (!composeRes.ok) throw new Error('Prompt composition failed');

      const { prompt, negatives } = await composeRes.json();

      console.log('[MobileCreatePage] Composed prompt:', prompt);

      // Generate image using existing working endpoint
      const genRes = await fetch(`${apiUrl}/api/nano-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          negative: negatives,
          aspectRatio: '3:4',
        }),
      });

      if (!genRes.ok) {
        const error = await genRes.json();
        throw new Error(error.error || 'Generation failed');
      }

      const { imageData, mimeType, key } = await genRes.json();

      console.log('[MobileCreatePage] Generated:', { key, mimeType });

      // Convert base64 to blob for immediate display
      const imgBlob = base64ToBlob(imageData, mimeType);
      const blobUrl = URL.createObjectURL(imgBlob);

      // Store blob and base64 data for later upload
      setGeneratedAsset({
        key,
        blobUrl,
        finalUrl: null, // Will be set after upload on save/publish
        answers: answersData,
        dna,
        prompt,
        imageData, // Store base64 for upload
        mimeType,
      } as any);

      setStage('revealing');
    } catch (error) {
      console.error('[handleGenerate] Error:', error);
      alert(error instanceof Error ? error.message : COPY.errors.generateFailed);
      setStage('coaching');
    }
  };

  const handleRevealDone = () => {
    setShowButtons(true);
    setStage('done');
  };

  const handlePublish = async () => {
    if (!generatedAsset) {
      alert(COPY.errors.noImage);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        alert(COPY.errors.loginRequired);
        return;
      }

      const token = sessionData.session.access_token;
      const userId = sessionData.session.user.id;
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const asset = generatedAsset;

      // Upload to R2 via server-side API (avoids CORS issues)
      console.log('[handlePublish] Uploading to R2 via server...');
      const uploadRes = await fetch(`${apiUrl}/api/upload-to-r2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageData: asset.imageData,
          mimeType: asset.mimeType,
          key: asset.key,
        }),
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || COPY.errors.upload);
      }

      const { url: finalUrl } = await uploadRes.json();
      console.log('[handlePublish] Upload successful:', finalUrl);
      console.log('[handlePublish] Publishing to gallery:', finalUrl);

      // Publish directly - this will create both images and published_items records
      const response = await fetch(`${apiUrl}/api/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image_url: finalUrl,
          r2_key: asset.key,
          title: 'My Design',
          description: '生成されたデザイン',
          tags: [],
          colors: [],
          category: 'clothing',
          price: 0,
          generation_data: {
            session_id: sessionKey,
            prompt: asset.prompt,
            parameters: {
              answers: asset.answers,
              dna: asset.dna,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[handlePublish] Publish failed:', errorData);
        throw new Error(errorData.error || '公開に失敗しました');
      }

      const result = await response.json();
      console.log('[handlePublish] Successfully published:', result);

      alert(COPY.status.publishSuccess);
      onNavigate?.('gallery');
    } catch (error) {
      console.error('[handlePublish] Error:', error);
      alert(error instanceof Error ? error.message : COPY.status.publishError);
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedAsset) {
      alert(COPY.errors.noImage);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        alert(COPY.errors.loginRequired);
        return;
      }

      const token = sessionData.session.access_token;
      const userId = sessionData.session.user.id;
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const asset = generatedAsset;

      // Upload to R2 via server-side API (avoids CORS issues)
      console.log('[handleSaveDraft] Uploading to R2 via server...');
      const uploadRes = await fetch(`${apiUrl}/api/upload-to-r2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageData: asset.imageData,
          mimeType: asset.mimeType,
          key: asset.key,
        }),
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || COPY.errors.upload);
      }

      const { url: finalUrl } = await uploadRes.json();
      console.log('[handleSaveDraft] Upload successful:', finalUrl);

      // Save to generation_history as draft (is_public: false)
      const response = await fetch(`${apiUrl}/api/upload-generated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          images: [{
            url: finalUrl,
            r2_key: asset.key,  // Already uploaded to R2
          }],
          generation_data: {
            session_id: sessionKey,
            prompt: asset.prompt,
            parameters: {
              answers: asset.answers,
              dna: asset.dna,
            },
          },
          is_public: false, // Mark as draft (not public)
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || COPY.drafts.failed);
      }

      console.log('Draft saved:', asset.key);
      alert(COPY.drafts.saved);
      onNavigate?.('mypage');
    } catch (error) {
      console.error('[handleSaveDraft] Error:', error);
      alert(error instanceof Error ? error.message : COPY.drafts.failed);
    }
  };

  const handleMenuNavigate = (page: string) => {
    onNavigate?.(page);
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
            <path
              d="M3 12H21M3 6H21M3 18H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button className="create-logo-btn" onClick={() => onNavigate?.('home')}>
          OWM
        </button>
      </header>

      <div className="create-content">
        {/* Stage: Answering (5 questions) */}
        {stage === 'answering' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                <MetaballsSoft ref={metaballsRef} animated={true} />
              </div>
              <div className="create-hero__title">
                <h1 className="create-title">CREATE</h1>
              </div>
            </div>

            <div className="question-container">
              <h2 className="question-text">{currentQuestion.question}</h2>
              {currentQuestion.multiSelect && <p className="hint-text">{COPY.flow.multiSelectHint}</p>}
            </div>

            <div className="options-container">
              {currentQuestion.options.map((option) => (
                <button
                  key={option}
                  className={`option-btn ${isSelected(option) ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  <span className="option-check">{isSelected(option) && '✓'}</span>
                  <span className="option-label">{option}</span>
                </button>
              ))}
            </div>

            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="progress-text">
                {currentStep + 1} / {createQuestions.length}
              </p>
            </div>

            <div className="nav-buttons">
              <button className="nav-btn primary" onClick={handleNext} disabled={!canProceed()}>
                {COPY.flow.next}
              </button>
            </div>

            {currentStep >= 1 && (
              <div className="secondary-nav-buttons">
                <button className="reset-btn" onClick={handleReset}>
                  {COPY.flow.restart}
                </button>
                <button className="back-btn" onClick={handleBack}>
                  {COPY.flow.back}
                </button>
              </div>
            )}
          </>
        )}

        {/* Stage: Coaching */}
        {stage === 'coaching' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                <MetaballsSoft ref={metaballsRef} animated={true} />
              </div>
              <div className="create-hero__title">
                <h1 className="create-title">{COPY.flow.guidance}</h1>
              </div>
            </div>

            <div className="coaching-container">
              <h2 className="question-text">{COPY.flow.guidanceTooltip}</h2>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder={COPY.flow.placeholder}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  marginBottom: '16px',
                }}
              />

              {!coachData && (
                <button
                  className="nav-btn primary"
                  onClick={handleCoach}
                  disabled={isCoaching}
                  style={{ marginBottom: '16px' }}
                >
                  {isCoaching ? COPY.flow.coachButtonLoading : COPY.flow.coachButton}
                </button>
              )}

              {coachData && (
                <>
                  <h3 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                    {COPY.flow.chips}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {coachData.chips.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleChipToggle(chip)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: selectedChips.includes(chip)
                            ? '2px solid #000'
                            : '1px solid #ccc',
                          background: selectedChips.includes(chip) ? '#000' : '#fff',
                          color: selectedChips.includes(chip) ? '#fff' : '#000',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {coachData.ask && (
                    <>
                      <h3 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
                        {coachData.ask.title}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        {coachData.ask.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleAskSelect(option)}
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: askAnswer === option ? '2px solid #000' : '1px solid #ddd',
                              background: askAnswer === option ? '#f0f0f0' : '#fff',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <button className="nav-btn primary" onClick={handlePreview}>
                    {COPY.flow.toPreview}
                  </button>
                </>
              )}

              {!coachData && (
                <button
                  className="nav-btn secondary"
                  onClick={handlePreview}
                  style={{ marginTop: '8px' }}
                >
                  {COPY.flow.skip}
                </button>
              )}
            </div>
          </>
        )}

        {/* Stage: Preview */}
        {stage === 'preview' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                <MetaballsSoft ref={metaballsRef} animated={true} />
              </div>
              <div className="create-hero__title">
                <h1 className="create-title">{COPY.pages.REVIEW}</h1>
              </div>
            </div>

            <p style={{
              fontFamily: "'Noto Sans CJK JP', 'Noto Sans JP', sans-serif",
              fontSize: '14px',
              color: '#666',
              marginTop: '16px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              {COPY.flow.reflected}
            </p>

            <div className="nav-buttons">
              <button className="nav-btn primary" onClick={handleGenerate}>
                {COPY.cta.generate}
              </button>
              <button
                className="nav-btn secondary"
                onClick={() => setStage('coaching')}
                style={{ marginTop: '8px' }}
              >
                {COPY.flow.back}
              </button>
            </div>
          </>
        )}

        {/* Stage: Generating */}
        {stage === 'generating' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                <MetaballsSoft animated={true} />
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  fontFamily: "'Trajan Pro', serif",
                  fontSize: 20,
                  fontWeight: 300,
                  letterSpacing: '0.1em',
                  color: '#000',
                  marginBottom: 8,
                }}
              >
                {COPY.pages.CREATE}
              </div>
              <div
                style={{
                  fontFamily: "'Noto Sans CJK JP', 'Noto Sans JP', sans-serif",
                  fontSize: 14,
                  fontWeight: 300,
                  color: '#666',
                }}
              >
                {COPY.loading.generating}
              </div>
            </div>
          </>
        )}

        {/* Stage: Revealing & Done */}
        {(stage === 'revealing' || stage === 'done') && generatedAsset && displayUrl && (
          <>
            <div
              className="viewer-container"
              style={{
                position: 'relative',
                width: 'calc(100% + 40px)',
                height: 'calc(100vw)',
                marginTop: '32px',
                marginBottom: '24px',
                marginLeft: '-20px',
                marginRight: '-20px',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden' }}>
                <GlassRevealCanvas
                  key={sessionKey}
                  imageUrl={displayUrl}
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
                  active={stage === 'revealing'}
                />
              </div>
            </div>


            {stage === 'done' && showButtons && (
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div
                  style={{
                    fontFamily: "'Trajan Pro', serif",
                    fontSize: 20,
                    fontWeight: 300,
                    letterSpacing: '0.1em',
                    color: '#000',
                    marginBottom: 8,
                  }}
                >
                  {COPY.pages.REFINE}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Sans CJK JP', 'Noto Sans JP', sans-serif",
                    fontSize: 14,
                    fontWeight: 300,
                    color: '#666',
                  }}
                >
                  {COPY.cta.heroSecondary}
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
