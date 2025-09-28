import { Asset } from '../lib/types';
import { Icons } from './Icons';
import { useAuth } from '../lib/AuthContext';
import { useState } from 'react';

interface DetailModalProps {
  asset: Asset;
  onClose: () => void;
  onLike: () => void;
  similar: Asset[];
  onPurchase: () => void;
  onSelectSimilar?: (asset: Asset) => void;
  onPublishToGallery?: (asset: Asset) => void;
}

export function DetailModal({ asset, onClose, onLike, similar, onPurchase, onSelectSimilar, onPublishToGallery }: DetailModalProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!user) {
      console.log('User must be logged in to save');
      return;
    }

    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          image_id: asset.id
        })
      });

      if (response.ok) {
        const { saved: isSaved } = await response.json();
        setSaved(isSaved);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-6xl w-full grid md:grid-cols-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 md:p-6 grid place-items-center bg-zinc-50">
          <img src={asset.src} alt={asset.title} className="max-h-[75vh] w-auto object-contain rounded-xl" />
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{asset.title}</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {asset.tags.map((t) => (
                  <span key={t} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border">
                    {t}
                  </span>
                ))}
                {asset.isAd && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-amber-500 text-amber-600">AD</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={onLike} className="px-3 py-1.5 rounded-lg border hover:bg-black/5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1"><Icons.Heart size={16} />{asset.likes}</span>
              </button>
              <button 
                onClick={handleSave}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 ${
                  saved 
                    ? 'bg-green-500 text-white border-green-500' 
                    : 'bg-accent text-white border-accent'
                }`}
              >
                <Icons.Bookmark size={14} />
                {saved ? '保存済み' : '保存'}
              </button>
            </div>
          </div>

          {asset.colors && <div className="text-sm text-zinc-600">Colors: {asset.colors.join(", ")}</div>}
          
          {/* Action section - Purchase or Publish */}
          {asset.type === 'generated' ? (
            <div className="space-y-3">
              <div className="text-lg font-medium">生成画像の管理</div>
              <div className="flex gap-3">
                <button 
                  onClick={() => onPublishToGallery?.(asset)}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                >
                  <Icons.Sparkles size={16} />
                  公開ギャラリーに追加
                </button>
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 font-medium flex items-center gap-2"
                >
                  <Icons.Gallery size={16} />
                  マイギャラリーに保存
                </button>
              </div>
              <div className="text-sm text-zinc-600">
                公開すると法人ユーザーが購入可能になります（AI価格設定: ¥{(asset.price || 5000).toLocaleString()}）
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Buy (std. license): ¥{(asset.price || 5000).toLocaleString()}</div>
              <button 
                onClick={onPurchase}
                className="px-4 py-1.5 rounded-lg bg-black text-white hover:bg-zinc-800"
              >
                購入
              </button>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Similar designs</h4>
            <div className="grid grid-cols-3 gap-2">
              {similar.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectSimilar?.(s)}
                  className="hover:opacity-80 transition-opacity"
                >
                  <img src={s.src} alt={s.title} className="w-full h-28 object-cover rounded-lg" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 text-xs text-zinc-500">
            {asset.isAd ? "広告 ・ このプロモーションは例示です" : "出品者例 ・ ライセンスは購入時に発行"}
          </div>
        </div>
      </div>
    </div>
  );
}