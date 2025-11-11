import React, { useState, useEffect } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import './MobilePublishFormPage.css';

interface MobilePublishFormPageProps {
  onNavigate?: (page: string) => void;
  onPublish?: (data: PublishData) => void;
  imageUrl: string;
  generationData?: any;
}

export interface PublishData {
  title: string;
  category: string;
  description: string;
  tags: string[];
  saleType: 'buyout' | 'subscription';
  price: number;
  posterUrl?: string;
  finalImageUrl?: string; // The actual image URL to display on complete page
}

export function MobilePublishFormPage({ onNavigate, onPublish, imageUrl, generationData }: MobilePublishFormPageProps) {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [tag1, setTag1] = useState('');
  const [tag2, setTag2] = useState('');
  const [tag3, setTag3] = useState('');
  const [saleType, setSaleType] = useState<'buyout' | 'subscription'>('buyout');
  const [price, setPrice] = useState(36323);

  // AI auto-generated fields
  const [aiDescription, setAiDescription] = useState('');
  const [aiCategory, setAiCategory] = useState('');
  const [aiCategoryConfidence, setAiCategoryConfidence] = useState(0);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Variant images (main, side, back)
  const [variants, setVariants] = useState<Array<{ type: 'main' | 'side' | 'back'; url: string; status: 'completed' | 'loading' | 'failed' }>>([
    { type: 'main', url: imageUrl, status: 'completed' }
  ]);
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0);

  const platformFee = Math.floor(price * 0.1);
  const netProfit = price - platformFee;

  // Fetch AI-generated category, tags, and description on mount
  useEffect(() => {
    const fetchAiData = async () => {
      if (!generationData?.session_id && !imageUrl) return;

      setIsLoadingAi(true);
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

      try {
        // Fetch auto-category
        const catRes = await fetch(`${apiUrl}/api/auto/category`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gen_id: generationData?.session_id })
        });

        if (catRes.ok) {
          const { category: autoCat, confidence } = await catRes.json();
          setAiCategory(autoCat);
          setAiCategoryConfidence(confidence);
          setCategory(autoCat); // Set as initial value
        }

        // Fetch auto-tags
        const tagsRes = await fetch(`${apiUrl}/api/auto/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gen_id: generationData?.session_id })
        });

        if (tagsRes.ok) {
          const { auto_tags } = await tagsRes.json();
          setAiTags(auto_tags);
          // Set first 3 tags as initial values
          if (auto_tags[0]) setTag1(auto_tags[0]);
          if (auto_tags[1]) setTag2(auto_tags[1]);
          if (auto_tags[2]) setTag3(auto_tags[2]);
        }

        // Check if AI description exists from publish API
        if (generationData?.ai_description) {
          setAiDescription(generationData.ai_description);
          setDescription(generationData.ai_description);
        }
      } catch (error) {
        console.warn('[MobilePublishFormPage] Failed to fetch AI data:', error);
      } finally {
        setIsLoadingAi(false);
      }
    };

    fetchAiData();
  }, [generationData?.session_id, imageUrl]);

  // Start variant generation and SSE subscription
  useEffect(() => {
    if (!generationData?.session_id) return;

    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const genId = generationData.session_id;

    // Add skeleton loaders for side and back
    setVariants(prev => [
      ...prev,
      { type: 'side', url: '', status: 'loading' },
      { type: 'back', url: '', status: 'loading' }
    ]);

    // Start SSE connection
    const eventSource = new EventSource(`${apiUrl}/api/generation-stream/${genId}`);

    eventSource.addEventListener('connected', () => {
      console.log('[MobilePublishFormPage] SSE connected');
    });

    eventSource.addEventListener('variant', (e) => {
      const data = JSON.parse(e.data);
      console.log('[MobilePublishFormPage] Variant received:', data);

      setVariants(prev =>
        prev.map(v =>
          v.type === data.type
            ? { type: v.type, url: data.r2_url, status: 'completed' }
            : v
        )
      );
    });

    eventSource.addEventListener('error', (e: any) => {
      const data = e.data ? JSON.parse(e.data) : {};
      console.error('[MobilePublishFormPage] Variant error:', data);

      if (data.type) {
        setVariants(prev =>
          prev.map(v =>
            v.type === data.type
              ? { ...v, status: 'failed' }
              : v
          )
        );
      }
    });

    eventSource.onerror = () => {
      console.warn('[MobilePublishFormPage] SSE connection error');
      eventSource.close();
    };

    // Trigger variant generation in background
    (async () => {
      try {
        // Generate side view
        fetch(`${apiUrl}/api/generate/variant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gen_id: genId, view: 'side' })
        }).catch(err => console.warn('[MobilePublishFormPage] Side generation failed:', err));

        // Generate back view
        fetch(`${apiUrl}/api/generate/variant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gen_id: genId, view: 'back' })
        }).catch(err => console.warn('[MobilePublishFormPage] Back generation failed:', err));
      } catch (error) {
        console.error('[MobilePublishFormPage] Failed to trigger variant generation:', error);
      }
    })();

    return () => {
      eventSource.close();
    };
  }, [generationData?.session_id]);

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const handleRetryVariant = async (type: 'side' | 'back') => {
    if (!generationData?.session_id) return;

    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

    // Set to loading
    setVariants(prev =>
      prev.map(v => (v.type === type ? { ...v, status: 'loading' } : v))
    );

    try {
      await fetch(`${apiUrl}/api/generate/variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gen_id: generationData.session_id, view: type })
      });
    } catch (error) {
      console.error(`[MobilePublishFormPage] Retry ${type} failed:`, error);
      setVariants(prev =>
        prev.map(v => (v.type === type ? { ...v, status: 'failed' } : v))
      );
    }
  };

  const handlePublish = async () => {
    // ログインチェック
    if (!user?.id) {
      alert('ログインが必要です');
      onNavigate?.('login');
      return;
    }

    // バリデーション
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    if (!category) {
      alert('カテゴリーを選択してください');
      return;
    }

    const tags = [tag1, tag2, tag3].filter(t => t.trim() !== '');

    const publishData: PublishData = {
      title,
      category,
      description,
      tags,
      saleType,
      price
    };

    // 楽観的UI更新: 即座に成功トーストを表示して完了画面に遷移
    showToast('✓ ギャラリーに公開しました');
    if (onPublish) {
      onPublish({ ...publishData, posterUrl: imageUrl, finalImageUrl: imageUrl });
    }

    // バックグラウンドでAPI呼び出しを実行
    (async () => {
      try {
        console.log('[MobilePublishFormPage] Starting publish process in background...');

        // Get auth token
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.error('[MobilePublishFormPage] No session found');
          return;
        }

        const token = sessionData.session.access_token;
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        let posterUrl = imageUrl;

        // 1. ポスター合成APIを呼び出し（失敗してもスキップ）
        try {
          const composeRes = await fetch(`${apiUrl}/api/compose-poster`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ imageUrl }),
          });

          if (composeRes.ok) {
            const composeData = await composeRes.json();
            posterUrl = composeData.posterUrl;
            console.log('[MobilePublishFormPage] Poster composed:', posterUrl);
          }
        } catch (composeError) {
          console.warn('[MobilePublishFormPage] Compose API unavailable:', composeError);
        }

        // 2. Supabaseに保存
        const requestBody = {
          image_url: imageUrl, // Use imageUrl as both original and poster
          r2_key: generationData?.r2_key || null,
          title: publishData.title,
          description: publishData.description,
          tags: publishData.tags,
          colors: [], // TODO: Extract from generation data if available
          category: publishData.category,
          price: publishData.price,
          generation_data: generationData || null,
        };

        const publishRes = await fetch(`${apiUrl}/api/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
        });

        if (!publishRes.ok) {
          throw new Error(`公開に失敗しました: ${publishRes.status}`);
        }

        const responseData = await publishRes.json();
        console.log('[MobilePublishFormPage] Publish completed:', responseData);
      } catch (error) {
        console.error('[MobilePublishFormPage] Background publish error:', error);
        // エラーは静かに記録（ユーザーは既に次のページに進んでいる）
      }
    })();
  };

  const showToast = (message: string, isError: boolean = false) => {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: ${isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(0, 0, 0, 0.85)'};
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 14px;
      z-index: 10000;
      animation: fadeInUp 0.3s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOutDown 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      alert('ログインが必要です');
      onNavigate?.('login');
      return;
    }

    try {
      // 楽観的UI更新: 即座に成功メッセージを表示してアーカイブに遷移
      showToast('✓ ドラフトに保存しました');
      onNavigate?.('mypage');

      // バックグラウンドでAPI呼び出しを実行
      (async () => {
        try {
          console.log('[MobilePublishFormPage] Saving draft in background...');

          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            console.error('[MobilePublishFormPage] No session found');
            return;
          }

          const token = sessionData.session.access_token;
          const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

          // Extract r2_key from imageUrl or generationData
          const r2Key = generationData?.r2_key || imageUrl.split('/').pop() || `draft-${Date.now()}.png`;

          const response = await fetch(`${apiUrl}/api/upload-generated`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              user_id: user.id,
              images: [{
                url: imageUrl,
                r2_key: r2Key,
              }],
              generation_data: {
                session_id: generationData?.session_id || `draft-${Date.now()}`,
                prompt: title || 'Untitled Draft',
                parameters: {
                  title,
                  category,
                  description,
                  tags: [tag1, tag2, tag3].filter(t => t.trim() !== ''),
                  saleType,
                  price,
                },
              },
              is_public: false, // ドラフトとして保存
            }),
          });

          if (!response.ok) {
            throw new Error(`Draft save failed: ${response.status}`);
          }

          const result = await response.json();
          console.log('[MobilePublishFormPage] Draft saved successfully:', result);
        } catch (error) {
          console.error('[MobilePublishFormPage] Background draft save error:', error);
        }
      })();
    } catch (error) {
      console.error('[MobilePublishFormPage] Error:', error);
      showToast('ドラフト保存に失敗しました', true);
    }
  };

  return (
    <div className="mobile-publish-form-page">
      {/* Header */}
      <header className="publish-form-header">
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="logo-btn" onClick={() => onNavigate?.('studio')}>OWM</button>
      </header>

      <div className="publish-form-content">
        <h1 className="publish-form-title">デザインを公開する</h1>

        {/* プレビュー画像カルーセル */}
        <div className="preview-carousel">
          <div className="carousel-container">
            {variants.map((variant, index) => (
              <div
                key={variant.type}
                className={`carousel-slide ${index === currentVariantIndex ? 'active' : ''}`}
                style={{ transform: `translateX(${(index - currentVariantIndex) * 100}%)` }}
              >
                {variant.status === 'loading' ? (
                  <div className="variant-skeleton">
                    <div className="skeleton-loader" />
                    <p>Generating {variant.type} view...</p>
                  </div>
                ) : variant.status === 'failed' ? (
                  <div className="variant-failed">
                    <p>Generation failed</p>
                    <button onClick={() => handleRetryVariant(variant.type as 'side' | 'back')}>
                      Retry
                    </button>
                  </div>
                ) : (
                  <img src={variant.url} alt={`${variant.type} view`} />
                )}
              </div>
            ))}
          </div>

          {/* Carousel navigation dots */}
          <div className="carousel-dots">
            {variants.map((variant, index) => (
              <button
                key={variant.type}
                className={`dot ${index === currentVariantIndex ? 'active' : ''}`}
                onClick={() => setCurrentVariantIndex(index)}
                aria-label={`View ${variant.type}`}
              />
            ))}
          </div>

          {/* Swipe instructions */}
          {variants.length > 1 && (
            <div className="carousel-hint">Swipe to see other views</div>
          )}
        </div>

        {/* 評価価格 */}
        <div className="price-estimate">
          <div className="price-label">
            評価価格
            <span className="info-icon">?</span>
          </div>
          <div className="price-value">¥{price.toLocaleString()}</div>
          <div className="price-breakdown">
            <div className="price-row">
              <span>販売手数料 (10%)</span>
              <span>{platformFee.toLocaleString()}</span>
            </div>
            <div className="price-row">
              <span>販売利益</span>
              <span>{netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* タイトル */}
        <div className="form-group">
          <label>タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder=""
          />
        </div>

        {/* カテゴリー */}
        <div className="form-group">
          <label>
            カテゴリー
            {aiCategory && (
              <span className="ai-badge" title={`AI推奨 (信頼度: ${Math.round(aiCategoryConfidence * 100)}%)`}>
                AI
              </span>
            )}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isLoadingAi}
          >
            <option value="">カテゴリーを選択してください</option>
            <option value="minimal">Minimal</option>
            <option value="street">Street</option>
            <option value="luxury">Luxury</option>
            <option value="outdoor">Outdoor</option>
            <option value="workwear">Workwear</option>
            <option value="y2k">Y2K</option>
            <option value="tailored">Tailored</option>
          </select>
        </div>

        {/* 説明文 */}
        <div className="form-group">
          <label>
            説明文
            {aiDescription && (
              <span className="ai-badge" title="AI生成">
                AI
              </span>
            )}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isLoadingAi ? 'AI分析中...' : ''}
            maxLength={150}
            disabled={isLoadingAi}
          />
          <div className="char-count">{description.length}/150</div>
        </div>

        {/* タグ設定 */}
        <div className="form-group">
          <label>
            タグ設定
            {aiTags.length > 0 && (
              <span className="ai-badge" title="AI推奨タグ">
                AI
              </span>
            )}
          </label>
          <input
            type="text"
            value={tag1}
            onChange={(e) => setTag1(e.target.value)}
            placeholder="#"
            disabled={isLoadingAi}
          />
          <input
            type="text"
            value={tag2}
            onChange={(e) => setTag2(e.target.value)}
            placeholder="#"
            disabled={isLoadingAi}
          />
          <input
            type="text"
            value={tag3}
            onChange={(e) => setTag3(e.target.value)}
            placeholder="#"
            disabled={isLoadingAi}
          />
          <button className="tag-add-btn">タグを追加する</button>
        </div>

        {/* 販売タイプ */}
        <div className="form-group">
          <label>
            販売タイプ
            <span className="info-icon">?</span>
          </label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                checked={saleType === 'buyout'}
                onChange={() => setSaleType('buyout')}
              />
              <span>買い切り</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                checked={saleType === 'subscription'}
                onChange={() => setSaleType('subscription')}
              />
              <span>サブスクリプション</span>
            </label>
          </div>
        </div>

        {/* 販売価格 */}
        <div className="form-group">
          <label>販売価格</label>
          <div className="price-display">¥{price.toLocaleString()}</div>
          <div className="price-breakdown">
            <div className="price-row">
              <span>販売手数料 (10%)</span>
              <span>{platformFee.toLocaleString()}</span>
            </div>
            <div className="price-row">
              <span>販売利益</span>
              <span>{netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* プライバシーポリシー */}
        <div className="privacy-notice">
          プライバシーポリシーに同意の上、「公開する」ボタンを押してください。
        </div>

        {/* ボタン */}
        <div className="form-buttons">
          <button className="draft-btn" onClick={handleSaveDraft}>
            ドラフトに保存
          </button>
          <button className="publish-btn" onClick={handlePublish}>
            公開する
          </button>
        </div>
      </div>

      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />
    </div>
  );
}
