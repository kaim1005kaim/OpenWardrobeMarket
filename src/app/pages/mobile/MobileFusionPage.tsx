import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { MetaballsBreathing } from '../../../components/Urula/MetaballsBreathing';
import GlassRevealCanvas from '../../../components/GlassRevealCanvas';
import { supabase } from '../../lib/supabase';
import { useDisplayImage } from '../../../hooks/useDisplayImage';
import { useDNA } from '../../../hooks/useDNA';
import { useUrula } from '../../lib/UrulaContext';
import { DEFAULT_DNA, createRandomDNA, type DNA } from '../../../types/dna';
import { COPY } from '../../../constants/copy';
import './MobileFusionPage.css';

interface MobileFusionPageProps {
  onNavigate?: (page: string) => void;
  onStartPublish?: (imageUrl: string, generationData: any) => void;
}

type Stage = 'upload' | 'analyzing' | 'preview' | 'generating' | 'revealing' | 'done';

interface MotifAbstraction {
  source_cue: string;
  operation: string;
  placement: string[];
  style: string;
  scale: string;
  notes: string;
}

interface FusionSpec {
  palette: { name: string; hex: string; weight: number }[];
  silhouette: string;
  materials: string[];
  motif_abstractions: MotifAbstraction[];
  details: string[];
  inspiration?: string;
}

interface UploadedImage {
  file: File;
  preview: string;
  base64: string;
  analysis?: {
    tags: string[];
    description: string;
    dna: Partial<DNA>;
    spec?: FusionSpec; // FUSION専用の詳細な仕様
  };
}

// Helper: File to Base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

export function MobileFusionPage({ onNavigate, onStartPublish }: MobileFusionPageProps) {
  const [stage, setStage] = useState<Stage>('upload');

  // Debug: log stage changes
  useEffect(() => {
    console.log('[MobileFusionPage] Stage changed to:', stage);
  }, [stage]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [image1, setImage1] = useState<UploadedImage | null>(null);
  const [image2, setImage2] = useState<UploadedImage | null>(null);
  const [optionalPrompt, setOptionalPrompt] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState('');

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  // DNA management
  const sessionKey = useRef(crypto.randomUUID()).current;
  const initialDNA = useRef(createRandomDNA()).current;
  const { dna, updateDNA, syncNow } = useDNA(sessionKey, initialDNA);

  // Urula profile management
  const { evolve } = useUrula();


  // Generation state
  const [generatedAsset, setGeneratedAsset] = useState<{
    key: string;
    blobUrl: string;
    finalUrl?: string | null;
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

  // Handle image selection
  const handleImageSelect = async (slot: 1 | 2, file: File) => {
    try {
      const preview = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);

      const uploadedImage: UploadedImage = {
        file,
        preview,
        base64,
      };

      if (slot === 1) {
        setImage1(uploadedImage);
      } else {
        setImage2(uploadedImage);
      }
    } catch (error) {
      console.error('[handleImageSelect] Error:', error);
      alert('画像の読み込みに失敗しました');
    }
  };

  const handleFileInput = (slot: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(slot, file);
    }
  };

  const handleCameraCapture = (slot: 1 | 2) => {
    if (slot === 1) {
      fileInput1Ref.current?.click();
    } else {
      fileInput2Ref.current?.click();
    }
  };

  // Analyze images with Gemini Vision
  const handleAnalyze = async () => {
    if (!image1 || !image2) {
      alert('2枚の画像を選択してください');
      return;
    }

    console.log('[handleAnalyze] Starting analysis with images:', {
      image1Type: image1.file.type,
      image1Size: image1.base64.length,
      image2Type: image2.file.type,
      image2Size: image2.base64.length,
    });

    setStage('analyzing');
    setAnalysisProgress('画像を解析中...');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('ログインが必要です');

      const token = sessionData.session.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

      console.log('[handleAnalyze] Using API URL:', apiUrl);

      // Analyze image 1
      setAnalysisProgress('1枚目の画像を解析中...');
      console.log('[handleAnalyze] Analyzing image 1...');
      const analysis1 = await analyzeImage(apiUrl, token, image1.base64, image1.file.type);
      console.log('[handleAnalyze] Image 1 analysis complete:', analysis1);

      // Analyze image 2
      setAnalysisProgress('2枚目の画像を解析中...');
      console.log('[handleAnalyze] Analyzing image 2...');
      const analysis2 = await analyzeImage(apiUrl, token, image2.base64, image2.file.type);
      console.log('[handleAnalyze] Image 2 analysis complete:', analysis2);

      // Create updated image objects with analysis
      const updatedImage1 = { ...image1, analysis: analysis1 };
      const updatedImage2 = { ...image2, analysis: analysis2 };

      // Blend DNAs
      setAnalysisProgress('DNAをブレンド中...');
      console.log('[handleAnalyze] Blending DNAs...');
      const blendedDNA = blendDNAs(analysis1.dna, analysis2.dna);
      console.log('[handleAnalyze] Blended DNA:', blendedDNA);

      // Update all state together
      console.log('[handleAnalyze] Updating state with:', {
        updatedImage1,
        updatedImage2,
        blendedDNA,
      });

      setImage1(updatedImage1);
      setImage2(updatedImage2);
      updateDNA(blendedDNA);
      setStage('preview');

      console.log('[handleAnalyze] Analysis complete, moved to preview');
    } catch (error) {
      console.error('[handleAnalyze] Error:', error);
      console.error('[handleAnalyze] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      alert(error instanceof Error ? error.message : '解析に失敗しました');
      setStage('upload');
    }
  };

  // Analyze single image with Gemini Vision (FUSION専用)
  const analyzeImage = async (
    apiUrl: string,
    token: string,
    base64: string,
    mimeType: string
  ): Promise<{ tags: string[]; description: string; dna: Partial<DNA>; spec: FusionSpec }> => {
    const imageData = base64.includes(',') ? base64.split(',')[1] : base64;

    console.log('[analyzeImage] Sending request to:', `${apiUrl}/api/gemini/analyze-fusion`);
    console.log('[analyzeImage] Image data length:', imageData.length);
    console.log('[analyzeImage] MIME type:', mimeType);

    const response = await fetch(`${apiUrl}/api/gemini/analyze-fusion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageData,
        mimeType,
        generateInspiration: true, // 動的インスピレーション文を生成
      }),
    });

    console.log('[analyzeImage] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyzeImage] Error response:', errorText);
      throw new Error(`画像解析に失敗しました (${response.status})`);
    }

    const spec: FusionSpec = await response.json();
    console.log('[analyzeImage] FUSION spec:', spec);

    // FUSIONスペックから従来のタグと説明を生成（後方互換性のため）
    const tags = [
      spec.silhouette,
      ...spec.materials.slice(0, 3),
      ...spec.palette.slice(0, 2).map(c => c.name),
      ...spec.details.slice(0, 3)
    ].filter(Boolean);

    const description = spec.inspiration ||
      `${spec.silhouette} design with ${spec.materials.join(', ')}`;

    // FUSIONスペックからDNAを生成
    const dna = fusionSpecToDNA(spec);

    return { tags, description, dna, spec };
  };

  // FUSIONスペックからDNAパラメータを生成
  const fusionSpecToDNA = (spec: FusionSpec): Partial<DNA> => {
    const dna: Partial<DNA> = {};

    // Silhouette mapping
    const silhouette = spec.silhouette?.toLowerCase() || '';
    if (silhouette.includes('oversized') || silhouette.includes('cocoon')) {
      dna.oversized_fitted = -0.4;
      dna.relaxed_tailored = -0.3;
    } else if (silhouette.includes('fitted') || silhouette.includes('a-line')) {
      dna.oversized_fitted = 0.4;
      dna.relaxed_tailored = -0.2;
    } else if (silhouette.includes('tailored')) {
      dna.oversized_fitted = 0.1;
      dna.relaxed_tailored = 0.4;
    }

    // Material-based vibe & texture
    const materials = spec.materials.map(m => m.toLowerCase());
    if (materials.some(m => m.includes('silk') || m.includes('satin') || m.includes('velvet'))) {
      dna.street_luxury = 0.4;
      dna.texture = 0.7;
    } else if (materials.some(m => m.includes('technical') || m.includes('nylon'))) {
      dna.street_luxury = -0.3;
      dna.texture = 0.2;
    } else if (materials.some(m => m.includes('wool'))) {
      dna.texture = 0.85;
    } else if (materials.some(m => m.includes('cotton') || m.includes('linen'))) {
      dna.texture = 0.15;
    }

    // Motif complexity → minimal_maximal
    const motifCount = spec.motif_abstractions?.length || 0;
    if (motifCount === 0) {
      dna.minimal_maximal = -0.5; // very minimal
    } else if (motifCount >= 3) {
      dna.minimal_maximal = 0.3; // more maximal
    } else {
      dna.minimal_maximal = -0.2; // slightly minimal
    }

    return dna;
  };

  // Convert tags to DNA parameters (legacy function - kept for compatibility)
  const tagsToDNA = (tags: string[]): Partial<DNA> => {
    const dna: Partial<DNA> = {};

    tags.forEach((tag) => {
      const lower = tag.toLowerCase();

      // Vibe
      if (lower.includes('minimal') || lower.includes('simple')) {
        dna.minimal_maximal = -0.3;
      }
      if (lower.includes('maximal') || lower.includes('ornate')) {
        dna.minimal_maximal = 0.3;
      }
      if (lower.includes('street')) {
        dna.street_luxury = -0.3;
      }
      if (lower.includes('luxury') || lower.includes('elegant')) {
        dna.street_luxury = 0.3;
      }

      // Silhouette
      if (lower.includes('oversized') || lower.includes('loose')) {
        dna.oversized_fitted = -0.3;
      }
      if (lower.includes('fitted') || lower.includes('tight')) {
        dna.oversized_fitted = 0.3;
      }
      if (lower.includes('relaxed')) {
        dna.relaxed_tailored = -0.3;
      }
      if (lower.includes('tailored') || lower.includes('structured')) {
        dna.relaxed_tailored = 0.3;
      }

      // Texture mapping (0-1 range)
      if (lower.includes('cotton') || lower.includes('canvas')) {
        dna.texture = 0.05;
      }
      if (lower.includes('denim')) {
        dna.texture = 0.15;
      }
      if (lower.includes('leather')) {
        dna.texture = 0.35;
      }
      if (lower.includes('wool')) {
        dna.texture = 0.95;
      }
      if (lower.includes('silk') || lower.includes('satin')) {
        dna.texture = 0.65;
      }
      if (lower.includes('velvet')) {
        dna.texture = 0.85;
      }
      if (lower.includes('suede')) {
        dna.texture = 0.75;
      }
    });

    return dna;
  };

  // Blend two DNA objects
  const blendDNAs = (dna1: Partial<DNA>, dna2: Partial<DNA>): DNA => {
    const blended = { ...DEFAULT_DNA };

    const keys: (keyof DNA)[] = [
      'minimal_maximal',
      'street_luxury',
      'oversized_fitted',
      'relaxed_tailored',
      'texture',
    ];

    keys.forEach((key) => {
      const val1 = dna1[key] ?? 0;
      const val2 = dna2[key] ?? 0;
      const avg = (val1 + val2) / 2;
      blended[key] = Math.max(-1, Math.min(1, avg)) as any;
    });

    return blended;
  };

  // Generate fashion image
  const handleGenerate = async () => {
    if (!image1?.analysis || !image2?.analysis) {
      alert('画像の解析が完了していません');
      return;
    }

    await syncNow();
    setStage('generating');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('ログインが必要です');

      const token = sessionData.session.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

      // Combine tags from both images
      const combinedTags = [
        ...image1.analysis.tags,
        ...image2.analysis.tags,
      ];

      // Create fusion prompt
      const fusionPrompt = createFusionPrompt(
        image1.analysis.description,
        image2.analysis.description,
        combinedTags,
        optionalPrompt
      );

      console.log('[MobileFusionPage] Fusion prompt:', fusionPrompt);

      // FUSION専用のnegativeプロンプト（背景・直喩を抑制）
      const fusionNegative = [
        'no city, no buildings, no torii, no streets, no signage, no text, no logos',
        'no busy environment, no props, no crowds, no landscape',
        'no literal objects from references, avoid scene illustration',
        'hands not covering garment, avoid extreme poses, no motion blur',
        'low quality, blurry, distorted, ugly, bad anatomy'
      ].join(', ');

      // Generate image
      const genRes = await fetch(`${apiUrl}/api/nano-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: fusionPrompt,
          negative: fusionNegative,
          aspectRatio: '3:4',
        }),
      });

      if (!genRes.ok) {
        const error = await genRes.json();
        throw new Error(error.error || 'Generation failed');
      }

      const { imageData, mimeType, key } = await genRes.json();

      console.log('[MobileFusionPage] Generated:', { key, mimeType });

      // Convert base64 to blob
      const imgBlob = base64ToBlob(imageData, mimeType);
      const blobUrl = URL.createObjectURL(imgBlob);

      setGeneratedAsset({
        key,
        blobUrl,
        finalUrl: null,
        dna,
        prompt: fusionPrompt,
        imageData,
        mimeType,
      });

      setStage('revealing');
    } catch (error) {
      console.error('[handleGenerate] Error:', error);
      alert(error instanceof Error ? error.message : COPY.errors.generateFailed);
      setStage('preview');
    }
  };

  // Create fusion-specific prompt (新テンプレート - 服優先設計)
  const createFusionPrompt = (
    desc1: string,
    desc2: string,
    tags: string[],
    userPrompt: string
  ): string => {
    if (!image1?.analysis?.spec || !image2?.analysis?.spec) {
      // Fallback to legacy prompt if specs are not available
      const tagString = [...new Set(tags)].slice(0, 15).join(', ');
      let prompt = `A high-quality fashion design photograph merging elements from two inspirations: "${desc1}" and "${desc2}". `;
      prompt += `Style attributes: ${tagString}. `;
      if (userPrompt) {
        prompt += `Additional direction: ${userPrompt}. `;
      }
      prompt += 'Professional studio lighting, 3:4 aspect ratio, fashion editorial style, clean background.';
      return prompt;
    }

    const spec1 = image1.analysis.spec;
    const spec2 = image2.analysis.spec;

    // ブレンドしたスペックを作成
    const blendedSpec = blendFusionSpecs(spec1, spec2);

    // Positive prompt
    let positive = 'FASHION EDITORIAL, full-body model centered, 3:4.\n';
    positive += 'Focus on GARMENT, studio cyclorama background, minimal scene.\n\n';

    // Silhouette
    positive += `SILHOUETTE: ${blendedSpec.silhouette}\n`;

    // Materials
    positive += `MATERIALS: ${blendedSpec.materials.join(', ')}\n`;

    // Palette
    const paletteStr = blendedSpec.palette
      .map(c => `${c.hex} ${c.name} (${Math.round(c.weight * 100)}%)`)
      .join(', ');
    positive += `PALETTE: ${paletteStr}, soft tonality.\n\n`;

    // Abstract motifs
    if (blendedSpec.motif_abstractions.length > 0) {
      positive += 'ABSTRACT MOTIFS (no literal objects):\n';
      blendedSpec.motif_abstractions.forEach(motif => {
        const placementStr = motif.placement.join(' & ');
        positive += `- ${motif.operation} on ${placementStr} in ${motif.style}, scale ${motif.scale} — from "${motif.source_cue}" → ${motif.notes}\n`;
      });
      positive += '\n';
    }

    // Detailing
    if (blendedSpec.details.length > 0) {
      positive += `DETAILING: ${blendedSpec.details.join(', ')}\n`;
    }

    // Construction & lighting
    positive += 'CONSTRUCTION: clean seamlines, couture finishing, refined drape.\n';
    positive += 'LIGHTING: soft editorial, high CRI, subtle specular to reveal texture.\n';
    positive += 'CAMERA: 50–85mm look, eye-level, product-forward.\n';

    // Inspiration text (dynamic)
    if (blendedSpec.inspiration) {
      positive += `\nINSPIRATION: ${blendedSpec.inspiration}\n`;
    }

    // User prompt
    if (userPrompt) {
      positive += `\nADDITIONAL DIRECTION: ${userPrompt}\n`;
    }

    console.log('[createFusionPrompt] Generated positive prompt:', positive);

    return positive;
  };

  // Blend two FUSION specs
  const blendFusionSpecs = (spec1: FusionSpec, spec2: FusionSpec): FusionSpec => {
    // Silhouette: pick from spec1 if available, else spec2
    const silhouette = spec1.silhouette || spec2.silhouette || 'tailored';

    // Materials: merge and deduplicate, limit to 2-3
    const materials = [...new Set([...spec1.materials, ...spec2.materials])].slice(0, 3);

    // Palette: mix both palettes, normalize weights
    const combinedPalette = [...spec1.palette, ...spec2.palette];
    const totalWeight = combinedPalette.reduce((sum, c) => sum + c.weight, 0);
    const normalizedPalette = combinedPalette.map(c => ({
      ...c,
      weight: c.weight / totalWeight
    }));
    // Sort by weight and take top 3
    const palette = normalizedPalette
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);

    // Motif abstractions: merge and limit to 3
    const motif_abstractions = [
      ...spec1.motif_abstractions,
      ...spec2.motif_abstractions
    ].slice(0, 3);

    // Details: merge and limit to 4
    const details = [...new Set([...spec1.details, ...spec2.details])].slice(0, 4);

    // Inspiration: combine both with "and"
    const inspiration = [spec1.inspiration, spec2.inspiration]
      .filter(Boolean)
      .join(' and ') || undefined;

    return {
      palette,
      silhouette,
      materials,
      motif_abstractions,
      details,
      inspiration
    };
  };

  const handleRevealDone = async () => {
    setShowButtons(true);
    setStage('done');

    // Evolve Urula profile
    if (generatedAsset && image1?.analysis && image2?.analysis) {
      const allTags = [
        ...image1.analysis.tags,
        ...image2.analysis.tags,
      ];

      await evolve({
        styleTags: allTags.slice(0, 10),
        colors: [],
        signals: {
          keep: true,
        },
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

      // Upload to R2
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

      // Analyze generated image for tags
      const imageData = asset.imageData!.includes(',')
        ? asset.imageData!.split(',')[1]
        : asset.imageData;

      const analyzeRes = await fetch(`${apiUrl}/api/gemini/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageData,
          mimeType: asset.mimeType,
        }),
      });

      let autoTags: string[] = [];
      let imageDescription = '';

      if (analyzeRes.ok) {
        const { tags, description } = await analyzeRes.json();
        autoTags = tags || [];
        imageDescription = description || '';
      }

      // Generate embedding
      let embedding: number[] | null = null;
      try {
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
        }
      } catch (error) {
        console.error('[handlePublish] Embedding generation error:', error);
      }

      // Save to generation_history for auto-category and auto-tags
      try {
        const { data: user, error: userError } = await supabase.auth.getUser();
        console.log('[handlePublish] Auth user check:', { hasUser: !!user?.user, userError });

        if (!user?.user) {
          console.error('[handlePublish] No authenticated user, skipping generation_history save');
        } else {
          console.log('[handlePublish] Attempting to save generation_history with session_id:', sessionKey);
          console.log('[handlePublish] Tags to save:', autoTags);

          const { data: savedGen, error: saveError } = await supabase
            .from('generation_history')
            .upsert({
              id: sessionKey,
              user_id: user.user.id,
              prompt: asset.prompt,
              negative_prompt: '',
              seed: Math.floor(Math.random() * 1000000),
              r2_key: asset.key,
              r2_url: finalUrl,
              tags: autoTags, // Save tags for auto-tags API
              metadata: {
                mode: 'fusion',
                image1_tags: image1?.analysis?.tags || [],
                image2_tags: image2?.analysis?.tags || [],
                dna: asset.dna,
                vibe_vector: {
                  luxury: asset.dna.street_luxury > 0 ? Math.abs(asset.dna.street_luxury) : 0,
                  street: asset.dna.street_luxury < 0 ? Math.abs(asset.dna.street_luxury) : 0,
                  minimal: asset.dna.minimal_maximal < 0 ? Math.abs(asset.dna.minimal_maximal) : 0,
                  maximal: asset.dna.minimal_maximal > 0 ? Math.abs(asset.dna.minimal_maximal) : 0,
                },
                ai_description: imageDescription,
                embedding: embedding
              },
              status: 'completed'
            }, {
              onConflict: 'id'
            });

          if (saveError) {
            console.error('[handlePublish] Failed to save generation_history:', saveError.message, saveError.details, saveError);
          } else {
            console.log('[handlePublish] ✅ Successfully saved to generation_history!');
            console.log('[handlePublish] Saved tags:', autoTags);
            console.log('[handlePublish] Saved record:', savedGen);
          }
        }
      } catch (saveError) {
        console.error('[handlePublish] Exception saving generation_history:', saveError);
      }

      // Pass to publish flow
      console.log('[handlePublish] Preparing generationData with session_id:', sessionKey);
      const generationData = {
        session_id: sessionKey,
        prompt: asset.prompt,
        parameters: {
          mode: 'fusion',
          image1_tags: image1?.analysis?.tags || [],
          image2_tags: image2?.analysis?.tags || [],
          dna: asset.dna,
        },
        auto_tags: autoTags,
        ai_description: imageDescription,
        embedding: embedding,
        r2_key: asset.key,
      };

      console.log('[handlePublish] Calling onStartPublish with generationData:', JSON.stringify(generationData, null, 2));
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

      // 楽観的UI更新: 即座に成功メッセージを表示してアーカイブに遷移
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
                  mode: 'fusion',
                  image1_tags: image1?.analysis?.tags || [],
                  image2_tags: image2?.analysis?.tags || [],
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
    <div className="mobile-fusion-page">
      {/* Header */}
      <header className="fusion-header">
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="fusion-logo-btn" onClick={() => onNavigate?.('studio')}>
          OWM
        </button>
      </header>

      {/* Urula breathing in background */}
      <div className="fusion-urula-bg">
        <MetaballsBreathing dna={dna} animated={true} />
      </div>

      <div className="fusion-content">
        {/* Upload Stage */}
        {stage === 'upload' && (
          <div className="upload-container">
            <h1 className="fusion-title">FUSION</h1>
            <p className="fusion-subtitle">IMAGE × IMAGE</p>
            <p className="fusion-description">
              Blend two images you love.<br />
              Urula will abstract them into a new design DNA.
            </p>

            {/* Image Upload Slots */}
            <div className="upload-slots">
              {/* Slot 1 */}
              <div className="upload-slot">
                {image1 ? (
                  <div className="uploaded-preview">
                    <img src={image1.preview} alt="Image 1" />
                    <button
                      className="remove-btn"
                      onClick={() => setImage1(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="upload-btn"
                    onClick={() => handleCameraCapture(1)}
                  >
                    <span className="upload-icon">📷</span>
                    <span className="upload-label">IMAGE 1</span>
                  </button>
                )}
                <input
                  ref={fileInput1Ref}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileInput(1)}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Slot 2 */}
              <div className="upload-slot">
                {image2 ? (
                  <div className="uploaded-preview">
                    <img src={image2.preview} alt="Image 2" />
                    <button
                      className="remove-btn"
                      onClick={() => setImage2(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="upload-btn"
                    onClick={() => handleCameraCapture(2)}
                  >
                    <span className="upload-icon">📷</span>
                    <span className="upload-label">IMAGE 2</span>
                  </button>
                )}
                <input
                  ref={fileInput2Ref}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileInput(2)}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Optional Prompt */}
            <div className="optional-prompt">
              <label className="prompt-label">
                OPTIONAL DIRECTION
              </label>
              <textarea
                className="prompt-textarea"
                placeholder="例: more colorful, urban style, vintage vibe..."
                value={optionalPrompt}
                onChange={(e) => setOptionalPrompt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Analyze Button */}
            <button
              className="analyze-btn"
              onClick={handleAnalyze}
              disabled={!image1 || !image2}
            >
              ANALYZE & BLEND
            </button>

            {/* Back Link */}
            <button
              className="back-link"
              onClick={() => onNavigate?.('create-home')}
            >
              BACK
            </button>
          </div>
        )}

        {/* Analyzing Stage */}
        {stage === 'analyzing' && (
          <div className="analyzing-container">
            <h2 className="analyzing-title">ANALYZING</h2>
            <p className="analyzing-status">{analysisProgress}</p>
            <div className="analyzing-spinner" />
          </div>
        )}

        {/* Preview Stage */}
        {stage === 'preview' && (
          <div className="preview-container">
            <h2 className="preview-title">DNA BLENDED</h2>
            <p className="preview-description">
              Two visual worlds merged into one design DNA.
            </p>

            {/* Analysis Results */}
            <div className="analysis-results">
              {image1?.analysis && (
                <div className="analysis-card">
                  <img src={image1.preview} alt="Image 1" className="analysis-thumb" />
                  <div className="analysis-tags">
                    {image1.analysis.tags.slice(0, 5).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="blend-icon">+</div>

              {image2?.analysis && (
                <div className="analysis-card">
                  <img src={image2.preview} alt="Image 2" className="analysis-thumb" />
                  <div className="analysis-tags">
                    {image2.analysis.tags.slice(0, 5).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="generate-btn" onClick={handleGenerate}>
              GENERATE DESIGN
            </button>

            {/* Back Link */}
            <button
              className="back-link"
              onClick={() => setStage('upload')}
            >
              BACK
            </button>
          </div>
        )}

        {/* Generating Stage */}
        {stage === 'generating' && (
          <div className="generating-container">
            <h2 className="generating-title">GENERATING</h2>
            <p className="generating-status">{COPY.loading.generating}</p>
          </div>
        )}

        {/* Revealing & Done Stages */}
        {(stage === 'revealing' || stage === 'done') && generatedAsset && displayUrl && (
          <div className="reveal-container">
            <div className="reveal-viewer">
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
