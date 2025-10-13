import { useState } from 'react';
import { Asset } from '../lib/types';
import { Icons } from './Icons';

interface ResultsBlockProps {
  items: Asset[];
  onPublish: (ids: string[]) => void;
  onRegenerate: () => void;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
}

export function ResultsBlock({ items, onPublish, onRegenerate, onLike, onSave }: ResultsBlockProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const handleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onLike(id);
  };

  const handleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSave(id);
  };

  return (
    <>
      {/* Results grid */}
      <div className="mx-auto max-w-screen-lg grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 px-3">
        {items.map((item) => (
          <article key={item.id} className="group">
            <div 
              className="relative rounded-2xl overflow-hidden cursor-pointer"
              style={{ aspectRatio: `${item.w}/${item.h}` }}
            >
              <img 
                src={item.src} 
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Selection overlay */}
              <button
                onClick={() => toggleSelection(item.id)}
                className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  selectedIds.includes(item.id)
                    ? 'bg-accent text-white'
                    : 'bg-white/80 backdrop-blur text-ink-900 hover:bg-white'
                }`}
              >
                {selectedIds.includes(item.id) ? (
                  <>
                    <Icons.Check size={12} />
                    選択中
                  </>
                ) : (
                  '選択'
                )}
              </button>

              {/* Gradient overlay for actions */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 text-white">
                  <button
                    onClick={(e) => handleLike(e, item.id)}
                    className="iconbtn text-white hover:text-accent"
                    aria-label="いいね"
                  >
                    <Icons.Heart size={16} />
                  </button>
                  <button
                    onClick={(e) => handleSave(e, item.id)}
                    className="iconbtn text-white hover:text-accent"
                    aria-label="保存"
                  >
                    <Icons.Bookmark size={16} />
                  </button>
                  <button
                    className="iconbtn text-white hover:text-accent ml-auto"
                    aria-label="その他"
                  >
                    <Icons.More size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Image info */}
            <div className="mt-2 px-1">
              <h3 className="text-sm font-medium text-ink-900 truncate">{item.title}</h3>
              <p className="text-xs text-ink-400 mt-1">
                {item.likes} いいね • by {item.creator}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Sticky action bar */}
      {items.length > 0 && (
        <div className="sticky bottom-4 mt-6 z-10">
          <div className="mx-auto max-w-screen-sm px-3">
            <div className="card p-3 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <button 
                  className="btn flex-1 flex items-center justify-center gap-2"
                  onClick={onRegenerate}
                >
                  <Icons.Regenerate size={16} />
                  再生成
                </button>
                <button
                  className={`btn flex-1 flex items-center justify-center gap-2 ${
                    selectedIds.length > 0 
                      ? 'bg-accent text-white border-accent hover:bg-accent/90' 
                      : ''
                  }`}
                  onClick={() => onPublish(selectedIds)}
                  disabled={selectedIds.length === 0}
                >
                  <Icons.Sparkles size={16} />
                  公開する {selectedIds.length > 0 && `(${selectedIds.length})`}
                </button>
              </div>
              
              {selectedIds.length === 0 && (
                <p className="text-xs text-ink-400 text-center mt-2">
                  公開したい画像を選択してください
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}