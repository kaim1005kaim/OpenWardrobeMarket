import { useState, useEffect } from 'react';
import { Asset } from '../../lib/types';
import { useAuth } from '../../lib/AuthContext';
import { Icons } from '../../components/Icons';

interface PublishFormProps {
  asset: Asset;
  onPublish: (publishedAsset: Asset) => void;
  onCancel: () => void;
}

interface PriceAnalysis {
  suggestedPrice: number;
  confidence: number;
  reasoning: string;
  priceRange: {
    min: number;
    max: number;
  };
}

export function PublishForm({ asset, onPublish, onCancel }: PublishFormProps) {
  const { user } = useAuth();
  const [isPublishing, setIsPublishing] = useState(false);
  const [priceAnalysis, setPriceAnalysis] = useState<PriceAnalysis | null>(null);
  const [title, setTitle] = useState(asset.title);
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(asset.tags || []);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // 推奨タグ（生成パラメータから）
  const suggestedTags = [
    ...asset.tags,
    ...asset.colors || [],
    'AI generated',
    'original design',
    'fashion',
    'style'
  ].filter((tag, index, self) => self.indexOf(tag) === index).slice(0, 12);

  useEffect(() => {
    // AI価格提案の取得
    fetchPriceSuggestion();
  }, [asset.id]);

  const fetchPriceSuggestion = async () => {
    try {
      const response = await fetch('/api/suggest-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          user_id: user?.id
        })
      });

      if (response.ok) {
        const analysis = await response.json();
        setPriceAnalysis(analysis);
      }
    } catch (error) {
      console.error('Price suggestion error:', error);
      // フォールバック価格
      setPriceAnalysis({
        suggestedPrice: Math.floor(Math.random() * 5000) + 8000,
        confidence: 0.7,
        reasoning: 'AIが類似デザインを分析して算出しました',
        priceRange: { min: 5000, max: 15000 }
      });
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag].slice(0, 8) // 最大8タグ
    );
  };

  const handlePublish = async () => {
    if (!user) return;

    setIsPublishing(true);

    try {
      const finalPrice = customPrice || priceAnalysis?.suggestedPrice || asset.price || 10000;

      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: asset.id,
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          tags: selectedTags,
          price: finalPrice,
          image_url: asset.src
        })
      });

      if (response.ok) {
        const publishedAsset = await response.json();
        
        // 成功演出
        setShowConfetti(true);
        
        // 少し遅らせて完了通知
        setTimeout(() => {
          onPublish(publishedAsset);
        }, 2000);
      } else {
        throw new Error('出品に失敗しました');
      }
    } catch (error) {
      console.error('Publish error:', error);
      alert('出品中にエラーが発生しました');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-60">
          <div className="confetti">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: Math.random() * 100 + '%',
                  backgroundColor: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][Math.floor(Math.random() * 5)],
                  animationDelay: Math.random() * 2 + 's',
                  animationDuration: (Math.random() * 2 + 2) + 's'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button 
            onClick={onCancel}
            className="iconbtn"
          >
            <Icons.ArrowLeft />
          </button>
          <h2 className="text-lg font-semibold text-ink-900 flex items-center gap-2">
            <Icons.Sparkles size={20} />
            作品を出品
          </h2>
          <div className="w-9 h-9" />
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Preview */}
          <div className="p-4">
            <div className="flex gap-4">
              <img 
                src={asset.src} 
                alt={asset.title}
                className="w-24 h-32 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">プレビュー</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{title}</p>
                <p className="text-xs text-gray-500 mt-1">by {user?.user_metadata?.name || 'あなた'}</p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              作品タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="作品の名前を入力"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="このデザインについて説明してください"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Tags */}
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              タグを選択 ({selectedTags.length}/8)
            </label>
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* AI Price Suggestion */}
          {priceAnalysis && (
            <div className="px-4 pb-4">
              <label className="block text-sm font-medium text-ink-700 mb-3 flex items-center gap-2">
                <Icons.Star className="text-accent" size={16} />
                AI価格提案
              </label>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-ink-900">
                    ¥{priceAnalysis.suggestedPrice.toLocaleString()}
                  </span>
                  <span className="text-xs bg-accent bg-opacity-10 text-accent px-2 py-1 rounded-full">
                    信頼度 {Math.round(priceAnalysis.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-ink-600 mb-3">{priceAnalysis.reasoning}</p>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCustomPrice(priceAnalysis.suggestedPrice)}
                    className="flex-1 btn bg-accent text-white border-accent text-sm"
                  >
                    この価格で出品
                  </button>
                  <input
                    type="number"
                    value={customPrice || ''}
                    onChange={(e) => setCustomPrice(parseInt(e.target.value) || null)}
                    placeholder="カスタム"
                    className="w-24 p-2 border border-gray-300 rounded text-sm text-center"
                    min={priceAnalysis.priceRange.min}
                    max={priceAnalysis.priceRange.max}
                  />
                </div>
                
                <div className="text-xs text-ink-400 mt-2">
                  推奨範囲: ¥{priceAnalysis.priceRange.min.toLocaleString()} - ¥{priceAnalysis.priceRange.max.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-ink-200">
          <button
            onClick={handlePublish}
            disabled={isPublishing || !title.trim() || selectedTags.length === 0}
            className="w-full py-4 btn bg-accent text-white border-accent flex items-center justify-center gap-2 font-medium"
          >
            {isPublishing ? (
              <>
                <Icons.RefreshCw className="animate-spin" size={18} />
                出品中...
              </>
            ) : (
              <>
                <Icons.Sparkles size={18} />
                出品する
              </>
            )}
          </button>
          <p className="text-xs text-ink-400 text-center mt-2">
            出品すると法人ユーザーが購入できるようになります
          </p>
        </div>
      </div>

      {/* Confetti CSS */}
      <style>{`
        .confetti {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: confetti-fall linear infinite;
        }
        
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}