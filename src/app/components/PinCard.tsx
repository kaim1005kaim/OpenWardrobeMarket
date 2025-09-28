import { Asset } from '../lib/types';
import { Icons } from './Icons';
import { colorToCss } from '../lib/util';

interface PinCardProps {
  asset: Asset;
  onOpen: (a: Asset) => void;
  onLike: (id: string) => void;
}

export function PinCard({ asset, onOpen, onLike }: PinCardProps) {
  return (
    <article className="mb-4 break-inside-avoid" style={{ breakInside: "avoid" }}>
      <div className="relative group rounded-2xl overflow-hidden cursor-pointer" onClick={() => onOpen(asset)}>
        <img src={asset.src} alt={asset.title} className="w-full h-auto object-cover" />
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100 transition">
          <div className="flex justify-end">
            <button 
              className="pointer-events-auto px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium shadow flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Icons.Bookmark size={14} />
              保存
            </button>
          </div>
          <div className="flex justify-between">
            <div className="flex gap-1.5">
              {asset.colors?.slice(0, 2).map((c) => (
                <span key={c} title={c} className="w-3 h-3 rounded-full border shadow" style={{ background: colorToCss(c) }} />
              ))}
            </div>
            <div className="flex gap-1">
              <button 
                className="pointer-events-auto px-2 py-1 rounded-full bg-white/95 border text-sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(asset.id);
                }}
              >
                <span className="inline-flex items-center gap-1"><Icons.Heart size={16} />{asset.likes || 0}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="px-1.5 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-300" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{asset.title}</div>
            <div className="text-xs text-zinc-500 truncate">
              {asset.isAd ? "広告 ・ Promoted" : asset.creator || "Creator"}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}