import React, { useState } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
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
}

export function MobilePublishFormPage({ onNavigate, onPublish, imageUrl, generationData }: MobilePublishFormPageProps) {
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

  const handlePublish = () => {
    const tags = [tag1, tag2, tag3].filter(t => t.trim() !== '');

    const publishData: PublishData = {
      title,
      category,
      description,
      tags,
      saleType,
      price
    };

    if (onPublish) {
      onPublish(publishData);
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
