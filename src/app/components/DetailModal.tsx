import { Asset } from '../lib/types';
import { HeartIcon } from './Icons';

interface DetailModalProps {
  asset: Asset;
  onClose: () => void;
  onLike: () => void;
  similar: Asset[];
  onPurchase: () => void;
}

export function DetailModal({ asset, onClose, onLike, similar, onPurchase }: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-6xl w-full grid md:grid-cols-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 md:p-6 grid place-items-center bg-zinc-50">
          <img src={asset.src} alt={asset.title} className="max-h-[75vh] w-auto object-contain rounded-xl" />
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
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
            <div className="flex gap-2">
              <button onClick={onLike} className="px-3 py-1.5 rounded-lg border hover:bg-black/5">
                <span className="inline-flex items-center gap-1"><HeartIcon className="w-4 h-4" />{asset.likes}</span>
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-orange-500 text-white border-orange-500">保存</button>
            </div>
          </div>

          <div className="text-sm text-zinc-600">Colors: {asset.colors.join(", ")}</div>
          {asset.price && (
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Buy (std. license): ¥{asset.price.toLocaleString()}</div>
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
                <img key={s.id} src={s.src} alt={s.title} className="w-full h-28 object-cover rounded-lg" />
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