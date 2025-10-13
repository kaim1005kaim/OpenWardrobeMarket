import React, { useState } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { useAuth } from '../../lib/AuthContext';
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

  const platformFee = Math.floor(price * 0.1);
  const netProfit = price - platformFee;

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
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

    try {
      console.log('[MobilePublishFormPage] Starting publish process...');

      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      console.log('[MobilePublishFormPage] API URL:', apiUrl);
      console.log('[MobilePublishFormPage] Image URL:', imageUrl);

      let posterUrl = imageUrl; // デフォルトはオリジナル画像

      // 1. ポスター合成APIを呼び出し（失敗してもスキップ）
      try {
        const composeRes = await fetch(`${apiUrl}/api/compose-poster`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        });

        console.log('[MobilePublishFormPage] Compose response status:', composeRes.status);

        if (composeRes.ok) {
          const composeData = await composeRes.json();
          posterUrl = composeData.posterUrl;
          console.log('[MobilePublishFormPage] Poster composed:', posterUrl);
        } else {
          const errorText = await composeRes.text();
          console.warn('[MobilePublishFormPage] Compose failed, using original image:', errorText);
        }
      } catch (composeError) {
        console.warn('[MobilePublishFormPage] Compose API unavailable, using original image:', composeError);
      }

      // 2. Supabaseに保存
      console.log('[MobilePublishFormPage] posterUrl:', posterUrl);
      console.log('[MobilePublishFormPage] imageUrl (originalUrl):', imageUrl);
      console.log('[MobilePublishFormPage] publishData:', publishData);

      const requestBody = {
        ...publishData,
        posterUrl,
        originalUrl: imageUrl,
        user_id: user!.id, // ログインユーザーのID（handlePublish冒頭でチェック済み）
      };
      console.log('[MobilePublishFormPage] requestBody keys:', Object.keys(requestBody));
      console.log('[MobilePublishFormPage] requestBody.posterUrl:', requestBody.posterUrl);
      console.log('[MobilePublishFormPage] requestBody.originalUrl:', requestBody.originalUrl);
      console.log('[MobilePublishFormPage] Publishing with data:', requestBody);

      const publishRes = await fetch(`${apiUrl}/api/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!publishRes.ok) {
        const errorText = await publishRes.text();
        console.error('[MobilePublishFormPage] Publish error response:', errorText);
        throw new Error(`公開に失敗しました: ${publishRes.status}`);
      }

      const responseData = await publishRes.json();
      console.log('[MobilePublishFormPage] Publish response:', responseData);

      const item = responseData.item || responseData.asset;
      if (item?.id) {
        console.log('[MobilePublishFormPage] Item published:', item.id);
      }

      // 3. 完了画面に遷移
      if (onPublish) {
        onPublish({ ...publishData, posterUrl });
      }
    } catch (error) {
      console.error('[MobilePublishFormPage] Publish error:', error);
      alert(error instanceof Error ? error.message : '公開に失敗しました');
    }
  };

  const handleSaveDraft = () => {
    // ドラフト保存処理
    console.log('[MobilePublishFormPage] Save draft');
    onNavigate?.('mypage');
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
        <button className="logo-btn" onClick={() => onNavigate?.('home')}>OWM</button>
      </header>

      <div className="publish-form-content">
        <h1 className="publish-form-title">デザインを公開する</h1>

        {/* プレビュー画像 */}
        <div className="preview-container">
          <img src={imageUrl} alt="生成画像" />
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
          <label>カテゴリー</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">カテゴリーを選択してください</option>
            <option value="minimal">Minimal</option>
            <option value="street">Street</option>
            <option value="luxury">Luxury</option>
            <option value="outdoor">Outdoor</option>
            <option value="workwear">Workwear</option>
            <option value="athleisure">Athleisure</option>
          </select>
        </div>

        {/* 説明文 */}
        <div className="form-group">
          <label>説明文</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder=""
            maxLength={150}
          />
          <div className="char-count">{description.length}/150</div>
        </div>

        {/* タグ設定 */}
        <div className="form-group">
          <label>タグ設定</label>
          <input
            type="text"
            value={tag1}
            onChange={(e) => setTag1(e.target.value)}
            placeholder="#"
          />
          <input
            type="text"
            value={tag2}
            onChange={(e) => setTag2(e.target.value)}
            placeholder="#"
          />
          <input
            type="text"
            value={tag3}
            onChange={(e) => setTag3(e.target.value)}
            placeholder="#"
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
