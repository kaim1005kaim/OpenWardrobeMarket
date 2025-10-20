import React, { useState, useEffect, useRef } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { supabase } from '../../lib/supabase';
import MetaballsSoft, { MetaballsSoftHandle } from '../../../components/MetaballsSoft';
import GlassRevealCanvas from '../../../components/GlassRevealCanvas';
import { useDisplayImage } from '../../../hooks/useDisplayImage';
import { useDNA } from '../../../hooks/useDNA';
import { useUrula } from '../../lib/UrulaContext';
import { DEFAULT_DNA, type DNA, type Answers, type GeminiCoachOut } from '../../../types/dna';
import { generateAutoTags } from '../../../lib/autoTags';
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
  onStartPublish?: (imageUrl: string, generationData: any) => void;
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
    options: ['ミニマル', 'ストリート', 'ラグジュアリー', 'アウトドア', 'ワークウェア', 'Y2K'],
  },
  {
    id: 'silhouette',
    question: COPY.questions.silhouette,
    options: ['オーバーサイズ', 'ルーズ', 'テーラード', 'タイト', 'Aライン', 'コクーン'],
  },
  {
    id: 'color',
    question: COPY.questions.color,
    options: ['palette'], // Single palette option
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
    options: ['春', '夏', '秋', '冬'],
  },
];

type Stage = 'answering' | 'coaching' | 'preview' | 'generating' | 'revealing' | 'done';

// Color palette grid - 4 rows x 7 columns like reference image
const colorPaletteGrid = [
  // Row 1: Black to white grayscale
  ['#000000', '#404040', '#707070', '#959595', '#B8B8B8', '#D9D9D9', '#FFFFFF'],
  // Row 2: Reds, pinks, purples, blues
  ['#E74C3C', '#FF6B6B', '#FF69B4', '#DA70D6', '#BA55D3', '#9370DB', '#0000FF'],
  // Row 3: Teals, cyans, light blues, mid blues, royal blues, navy blues
  ['#2C7A7B', '#17A2B8', '#00CED1', '#5DADE2', '#3498DB', '#2874A6', '#003366'],
  // Row 4: Greens, lime, yellow, orange shades
  ['#27AE60', '#52C41A', '#A8E6CF', '#F4D03F', '#F39C12', '#E67E22', '#FF8C42'],
];

// カラーIDから色名に変換するマップ
const colorIdToName: Record<string, string> = {
  // Row 1: Black to white grayscale
  'color-0-0': 'black', 'color-0-1': 'dark gray', 'color-0-2': 'gray', 'color-0-3': 'light gray',
  'color-0-4': 'silver', 'color-0-5': 'light silver', 'color-0-6': 'white',
  // Row 2: Reds, pinks, purples, blues
  'color-1-0': 'red', 'color-1-1': 'coral red', 'color-1-2': 'hot pink', 'color-1-3': 'orchid',
  'color-1-4': 'medium orchid', 'color-1-5': 'medium purple', 'color-1-6': 'blue',
  // Row 3: Teals, cyans, light blues, mid blues, royal blues, navy blues
  'color-2-0': 'teal', 'color-2-1': 'cyan', 'color-2-2': 'turquoise', 'color-2-3': 'sky blue',
  'color-2-4': 'dodger blue', 'color-2-5': 'steel blue', 'color-2-6': 'navy',
  // Row 4: Greens, lime, yellow, orange shades
  'color-3-0': 'green', 'color-3-1': 'lime green', 'color-3-2': 'mint', 'color-3-3': 'gold',
  'color-3-4': 'orange', 'color-3-5': 'coral', 'color-3-6': 'light coral',
};

// カラーIDの配列を色名の配列に変換する関数
const convertColorIdsToNames = (colorIds: string[]): string[] => {
  return colorIds.map(id => colorIdToName[id] || id).filter(Boolean);
};

// Hex to HSL conversion helper
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s, l };
}

export function MobileCreatePage({ onNavigate, onStartPublish }: MobileCreatePageProps) {
  const [stage, setStage] = useState<Stage>('answering');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [freeText, setFreeText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedBlendedColor, setSelectedBlendedColor] = useState<string | null>(null);

  // DNA management
  const sessionKey = useRef(`mobile-create-${Date.now()}`).current;
  const { dna, updateDNA, syncNow, updateContext } = useDNA(sessionKey, DEFAULT_DNA);
  const metaballsRef = useRef<MetaballsSoftHandle>(null);

  // Urula profile management
  const { profile, applyLocal, evolve, loading: profileLoading } = useUrula();

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

  // ステージが変更されたときにカラーを維持
  useEffect(() => {
    if (selectedBlendedColor && (stage === 'coaching' || stage === 'preview' || stage === 'generating')) {
      // 少し遅延させてからカラーを適用（レンダリング完了後）
      const timer = setTimeout(() => {
        metaballsRef.current?.triggerImpact(selectedBlendedColor);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [stage, selectedBlendedColor]);

  const handleSelect = (option: string, color?: string) => {
    const questionId = currentQuestion.id;
    const currentAnswers = answers[questionId] || [];

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

    // カラー選択の場合のみ、選択されている全色を取得してブレンド
    if (questionId === 'color' && color) {
      const selectedColors: string[] = [];

      // 新しい選択状態で選択されているカラーを収集
      colorPaletteGrid.forEach((row, rowIdx) => {
        row.forEach((gridColor, colIdx) => {
          const colorId = `color-${rowIdx}-${colIdx}`;
          if (newAnswers[questionId]?.includes(colorId)) {
            selectedColors.push(gridColor);
          }
        });
      });

      // 選択色に応じてエフェクトを更新
      if (selectedColors.length > 0) {
        const blendedColor = blendColors(selectedColors);
        setSelectedBlendedColor(blendedColor);
        metaballsRef.current?.triggerImpact(blendedColor);

        // Update Urula profile tint with selected color
        const { h, s, l } = hexToHSL(blendedColor);
        applyLocal({
          tint: { h, s, l }
        });
      } else {
        // 選択が全て解除された場合、デフォルトカラーに戻す
        setSelectedBlendedColor(null);
        metaballsRef.current?.changePalette();
      }
    } else {
      // カラー選択以外のクリックではアニメーションのみ（色は変えない）
      metaballsRef.current?.triggerImpact();
    }

    setAnswers(newAnswers);

    // Apply simple DNA delta based on selection
    applyAnswerDNA(questionId, option);
  };

  // 複数の色をブレンドする関数
  const blendColors = (colors: string[]): string => {
    if (colors.length === 0) return '#7FEFBD';
    if (colors.length === 1) return colors[0];

    let r = 0, g = 0, b = 0;

    colors.forEach(color => {
      const hex = color.replace('#', '');
      r += parseInt(hex.substring(0, 2), 16);
      g += parseInt(hex.substring(2, 4), 16);
      b += parseInt(hex.substring(4, 6), 16);
    });

    r = Math.round(r / colors.length);
    g = Math.round(g / colors.length);
    b = Math.round(b / colors.length);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
    // カラーが選択されている場合のみ色を維持（それ以外はデフォルトカラーを維持）
    if (selectedBlendedColor) {
      metaballsRef.current?.triggerImpact(selectedBlendedColor);
    }

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

      // カラーが選択されている場合は常に維持
      if (selectedBlendedColor) {
        metaballsRef.current?.triggerImpact(selectedBlendedColor);
      }
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setAnswers({});
    setFreeText('');
    setStage('answering');
    setSelectedBlendedColor(null);
    updateDNA(DEFAULT_DNA);
    metaballsRef.current?.changePalette();
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
    // カラーが選択されている場合は維持
    if (selectedBlendedColor) {
      metaballsRef.current?.triggerImpact(selectedBlendedColor);
    }
  };

  const handleGenerate = async () => {
    await syncNow(); // Sync DNA before generation

    setStage('generating');
    // カラーが選択されている場合は維持
    if (selectedBlendedColor) {
      metaballsRef.current?.triggerImpact(selectedBlendedColor);
    }

    try {
      const answersData: Answers = {
        vibe: answers.vibe || [],
        silhouette: answers.silhouette || [],
        color: convertColorIdsToNames(answers.color || []),
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

  const handleRevealDone = async () => {
    setShowButtons(true);
    setStage('done');

    // Evolve Urula profile based on generation
    if (generatedAsset) {
      const colorNames = convertColorIdsToNames(answers.color || []);
      const colorsWithHSL = colorNames.map(name => {
        // Find hex color from grid
        let hexColor = '#7FEFBD';
        colorPaletteGrid.forEach((row, rowIdx) => {
          row.forEach((gridColor, colIdx) => {
            const colorId = `color-${rowIdx}-${colIdx}`;
            if (colorIdToName[colorId] === name) {
              hexColor = gridColor;
            }
          });
        });
        const { h, s, l } = hexToHSL(hexColor);
        return { name, h, s, l };
      });

      const styleTags = [
        ...(answers.vibe || []),
        ...(answers.silhouette || []),
        ...(answers.occasion || []),
        ...(answers.season || []),
      ];

      await evolve({
        styleTags,
        colors: colorsWithHSL,
        signals: {
          keep: true, // User saw the result
        }
      });
    }
  };

  const handlePublish = async () => {
    if (!generatedAsset) {
      alert(COPY.errors.noImage);
      return;
    }

    if (!onStartPublish) {
      alert('公開機能が利用できません');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        alert(COPY.errors.loginRequired);
        return;
      }

      const token = sessionData.session.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const asset = generatedAsset;

      // Upload to R2 first to get the final URL
      console.log('[handlePublish] Uploading to R2...');
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

      // Generate rule-based auto tags
      const ruleTags = generateAutoTags({
        answers: asset.answers as Answers,
        dna: asset.dna,
        prompt: asset.prompt,
      });
      console.log('[handlePublish] Generated rule-based tags:', ruleTags);

      // Generate AI-based tags using Gemini Vision API
      let aiTags: string[] = [];
      let imageDescription = '';
      try {
        console.log('[handlePublish] Analyzing image with Gemini Vision...');
        const analyzeRes = await fetch(`${apiUrl}/api/gemini/analyze-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageData: asset.imageData,
            mimeType: asset.mimeType,
          }),
        });

        if (analyzeRes.ok) {
          const { tags, description } = await analyzeRes.json();
          aiTags = tags || [];
          imageDescription = description || '';
          console.log('[handlePublish] Gemini Vision tags:', aiTags);
          console.log('[handlePublish] Image description:', imageDescription);
        } else {
          console.warn('[handlePublish] Gemini Vision API failed, using rule-based tags only');
        }
      } catch (error) {
        console.error('[handlePublish] Gemini Vision error:', error);
        // Continue with rule-based tags only
      }

      // Combine rule-based and AI-based tags (remove duplicates)
      const autoTags = [...new Set([...ruleTags, ...aiTags])];
      console.log('[handlePublish] Combined auto tags:', autoTags);

      // Generate CLIP embedding for vector similarity search
      let embedding: number[] | null = null;
      try {
        console.log('[handlePublish] Generating CLIP embedding...');
        const embeddingRes = await fetch(`${apiUrl}/api/generate-embedding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageData: asset.imageData,
          }),
        });

        if (embeddingRes.ok) {
          const { embedding: embeddingVector } = await embeddingRes.json();
          embedding = embeddingVector;
          console.log('[handlePublish] Generated embedding with dimension:', embedding.length);
        } else {
          console.warn('[handlePublish] Embedding generation failed, continuing without vector search capability');
        }
      } catch (error) {
        console.error('[handlePublish] Embedding generation error:', error);
        // Continue without embedding - vector search won't be available for this item
      }

      // Pass image and generation data to PublishForm page
      const generationData = {
        session_id: sessionKey,
        prompt: asset.prompt,
        parameters: {
          answers: asset.answers,
          dna: asset.dna,
        },
        auto_tags: autoTags, // Include combined auto-generated tags
        ai_description: imageDescription, // Include AI-generated description
        embedding: embedding, // Include CLIP embedding vector
        r2_key: asset.key,
      };

      onStartPublish(finalUrl, generationData);
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

      // 楽観的UI更新: 即座に成功メッセージを表示してマイページに遷移
      alert(COPY.drafts.saved);
      onNavigate?.('mypage');

      // バックグラウンドでAPI呼び出しを実行
      (async () => {
        try {
          console.log('[handleSaveDraft] Uploading to R2 in background...');

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
            throw new Error('Upload failed');
          }

          const { url: finalUrl } = await uploadRes.json();
          console.log('[handleSaveDraft] Upload successful:', finalUrl);

          // Save to generation_history as draft
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
                r2_key: asset.key,
              }],
              generation_data: {
                session_id: sessionKey,
                prompt: asset.prompt,
                parameters: {
                  answers: asset.answers,
                  dna: asset.dna,
                },
              },
              is_public: false,
            }),
          });

          if (!response.ok) {
            throw new Error('Save draft failed');
          }

          console.log('[handleSaveDraft] Draft saved successfully:', asset.key);
        } catch (error) {
          console.error('[handleSaveDraft] Background error:', error);
          // エラーは静かに記録（ユーザーは既に次のページに進んでいる）
        }
      })();
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
        <button className="create-logo-btn" onClick={() => onNavigate?.('studio')}>
          OWM
        </button>
      </header>

      <div className="create-content">
        {/* Stage: Answering (5 questions) */}
        {stage === 'answering' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                {!profileLoading && <MetaballsSoft ref={metaballsRef} animated={true} profile={profile} />}
              </div>
              <div className="create-hero__title">
                <h1 className="create-title">CREATE</h1>
              </div>
            </div>

            <div className="question-container">
              <h2 className="question-text">{currentQuestion.question}</h2>
              {currentQuestion.multiSelect && <p className="hint-text">{COPY.flow.multiSelectHint}</p>}
            </div>

            {currentQuestion.id === 'color' ? (
              <div className="color-palette-grid">
                {colorPaletteGrid.map((row, rowIdx) => (
                  <div key={rowIdx} className="color-row">
                    {row.map((color, colIdx) => {
                      const colorId = `color-${rowIdx}-${colIdx}`;
                      return (
                        <button
                          key={colorId}
                          className={`color-square ${isSelected(colorId) ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleSelect(colorId, color)}
                          aria-label={`Color ${rowIdx + 1}-${colIdx + 1}`}
                        >
                          {isSelected(colorId) && (
                            <span className="color-check">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
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
            )}

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
                {!profileLoading && <MetaballsSoft ref={metaballsRef} animated={true} profile={profile} />}
              </div>
              <div className="create-hero__title">
                <h1 className="create-title smaller">{COPY.flow.guidance}</h1>
              </div>
            </div>

            <div className="coaching-container">
              <h2 className="question-text">{COPY.flow.guidanceTooltip}</h2>
              <textarea
                className="coaching-textarea"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder={COPY.flow.placeholder}
              />

              <div className="coaching-button-group">
                {!coachData && (
                  <button
                    className="nav-btn primary"
                    onClick={handleCoach}
                    disabled={isCoaching}
                    style={{ width: '100%', maxWidth: '360px' }}
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

                  <button className="preview-btn" onClick={handlePreview}>
                    {COPY.flow.toPreview}
                  </button>
                </>
              )}
              </div>

              <button
                className="preview-btn"
                onClick={handlePreview}
              >
                スキップ
              </button>

              <button
                className="preview-btn"
                onClick={() => setStage('answering')}
              >
                直前の行程に戻る
              </button>

              <button
                className="preview-btn"
                onClick={handleReset}
              >
                最初から始める
              </button>
            </div>
          </>
        )}

        {/* Stage: Preview */}
        {stage === 'preview' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                {!profileLoading && <MetaballsSoft ref={metaballsRef} animated={true} profile={profile} />}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '0 20px' }}>
              <button className="nav-btn primary" onClick={handleGenerate} style={{ width: '100%', maxWidth: '360px' }}>
                {COPY.cta.generate}
              </button>
              <button
                className="preview-btn"
                onClick={() => setStage('coaching')}
              >
                直前の行程に戻る
              </button>
            </div>
          </>
        )}

        {/* Stage: Generating */}
        {stage === 'generating' && (
          <>
            <div className="create-hero">
              <div className="create-hero__canvas">
                {!profileLoading && <MetaballsSoft animated={true} profile={profile} />}
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
                aspectRatio: '3 / 4', // Match ARCHIVE aspect ratio
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
