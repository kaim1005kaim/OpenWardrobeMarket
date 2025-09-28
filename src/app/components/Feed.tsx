import { Asset } from '../lib/types';
import { OptimizedPinCard } from './OptimizedPinCard';

interface FeedProps {
  refEl: React.MutableRefObject<HTMLDivElement | null>;
  assets: Asset[];
  onOpen: (a: Asset) => void;
  onLike: (id: string) => void;
  loading?: boolean;
}

export function Feed({ refEl, assets, onOpen, onLike, loading = false }: FeedProps) {
  if (loading) {
    return (
      <section ref={refEl} className="pb-10 overflow-y-auto">
        <div className="pt-4 px-1">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
            <p className="mt-4 text-zinc-500">カタログを読み込み中...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={refEl} className="pb-10 overflow-y-auto">
      <div className="pt-4 px-2 md:px-3 lg:px-4">
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-3 lg:gap-4 [column-fill:_balance]">
          {assets.map((a, index) => {
            // Calculate if this is in the first row based on dynamic column count
            const columnsCount = typeof window !== 'undefined' 
              ? (window.innerWidth >= 1536 ? 7 : window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 4 : window.innerWidth >= 640 ? 3 : 2)
              : 5;
            const isFirstRow = index < columnsCount;
            
            return (
              <div key={a.id} className="mb-4 break-inside-avoid">
                <OptimizedPinCard 
                  asset={a} 
                  onOpen={() => onOpen(a)} 
                  onLike={() => onLike(a.id)}
                  isFirstRow={isFirstRow}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface InnerGridProps {
  assets: Asset[];
}

export function InnerGrid({ assets }: InnerGridProps) {
  if (!assets?.length) return <div className="text-zinc-400 text-sm">（まだ生成はありません）</div>;
  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-3 lg:gap-4 [column-fill:_balance]">
      {assets.map((a, index) => {
        const columnsCount = typeof window !== 'undefined' 
          ? (window.innerWidth >= 1536 ? 7 : window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 4 : window.innerWidth >= 640 ? 3 : 2)
          : 5;
        const isFirstRow = index < columnsCount;
        
        return (
          <div key={a.id} className="mb-4 break-inside-avoid">
            <OptimizedPinCard 
              asset={a} 
              isFirstRow={isFirstRow}
            />
          </div>
        );
      })}
    </div>
  );
}