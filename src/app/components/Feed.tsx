import { Asset } from '../lib/types';
import { PinCard } from './PinCard';

interface FeedProps {
  refEl: React.MutableRefObject<HTMLDivElement | null>;
  assets: Asset[];
  onOpen: (a: Asset) => void;
  onLike: (id: string) => void;
}

export function Feed({ refEl, assets, onOpen, onLike }: FeedProps) {
  return (
    <section ref={refEl} className="pb-10 overflow-y-auto">
      <div className="pt-4 px-1">
        <div className="columns-2 sm:columns-3 lg:columns-5 xl:columns-5 2xl:columns-5 gap-4 [column-fill:_balance]">
          {assets.map((a) => (
            <PinCard key={a.id} asset={a} onOpen={onOpen} onLike={onLike} />
          ))}
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
    <div className="columns-2 sm:columns-3 lg:columns-5 xl:columns-5 2xl:columns-5 gap-4 [column-fill:_balance]">
      {assets.map((a) => (
        <div key={a.id} className="mb-4 break-inside-avoid">
          <img src={a.src} alt={a.title} className="w-full h-auto rounded-xl" />
        </div>
      ))}
    </div>
  );
}