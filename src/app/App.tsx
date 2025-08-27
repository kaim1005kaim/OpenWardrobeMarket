import { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, GenParams } from './lib/types';
import { buildPrompt } from './lib/prompt';
import { rand, pick, uniq, seedImg } from './lib/util';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { Feed, InnerGrid } from './components/Feed';
import { DetailModal } from './components/DetailModal';
import { CreatorChat } from './components/CreatorChat';
import { PurchasePage } from './components/PurchasePage';

const baseTags = [
  "minimal", "street", "luxury", "outdoor", "workwear", "athleisure", "retro",
  "avantgarde", "genderless", "utility", "tailored", "y2k", "techwear",
];

const basePalettes = ["black", "white", "navy", "earth", "pastel", "neon", "monochrome"];

function sizedAsset(i: number): Asset {
  const r = Math.random();
  let w = 800, h = 1200;
  if (r < 0.60) { w = rand(700, 900); h = rand(1100, 1400); }
  else if (r < 0.85) { w = rand(900, 1200); h = w; }
  else { w = rand(1100, 1400); h = rand(700, 900); }
  const id = `seed-${i}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const isAd = i > 0 && i % 12 === 0;
  return {
    id,
    src: seedImg(id, w, h),
    w,
    h,
    title: pick([
      "Urban minimal set",
      "Soft tailoring",
      "Street classic remix",
      "Elegant monochrome",
      "Outdoor light shell",
      "Clean utility",
      "Luxe drape",
    ]),
    tags: uniq([pick(baseTags), pick(baseTags), pick(baseTags)]),
    colors: uniq([pick(basePalettes), pick(basePalettes)]),
    price: rand(3000, 28000),
    creator: pick(["Kai Studio", "Mori Atelier", "DRA Lab", "OWM Creator", "Atelier 37"]),
    likes: rand(5, 200),
    isAd,
  };
}

function makeInitialAssets(n = 30): Asset[] {
  return Array.from({ length: n }).map((_, i) => sizedAsset(i));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"browse" | "trend" | "create" | "saved">("browse");
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<Asset[]>(() => makeInitialAssets());
  const [selected, setSelected] = useState<Asset | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<Asset | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const [gen, setGen] = useState<GenParams>({});
  const [recentGen, setRecentGen] = useState<Asset[]>([]);
  const [genCount, setGenCount] = useState<number>(6);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q)) ||
      a.colors.some((c) => c.toLowerCase().includes(q))
    );
  }, [assets, query]);

  useEffect(() => {
    const el: any = feedRef.current || window;
    const handler = () => {
      const scrollEl = feedRef.current;
      const bottomGap = scrollEl
        ? scrollEl.scrollHeight - (scrollEl.scrollTop + scrollEl.clientHeight)
        : document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (bottomGap < 600) {
        setAssets((prev) => [...prev, ...makeInitialAssets(14)]);
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const similarTo = (asset: Asset, limit = 8) => {
    const tagSet = new Set(asset.tags);
    const pool = assets.filter((a) => a.id !== asset.id && a.tags.some((t) => tagSet.has(t)));
    if (pool.length < limit) {
      const rest = assets.filter((a) => a.id !== asset.id && !pool.includes(a));
      return [...pool, ...rest].slice(0, limit);
    }
    return pool.slice(0, limit);
  };

  const toggleLike = (id: string) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, likes: a.likes + 1 } : a)));
  };

  const handleGenerate = (count?: number) => {
    const promptStr = buildPrompt(gen);
    console.log("[Generate] prompt:", promptStr);

    const k = count ?? genCount;
    const newOnes: Asset[] = Array.from({ length: k }).map((_, i) => {
      const w = rand(720, 900);
      const h = rand(900, 1260);
      const seed = `${promptStr || "owm"}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      const tags = uniq([
        gen.silhouette || pick(baseTags),
        gen.vibe || pick(baseTags),
        gen.season || pick(["ss", "aw", "resort", "pre-fall"]),
      ]);
      const colors = uniq([gen.palette || pick(basePalettes), pick(basePalettes)]);
      return {
        id: `gen-${seed}`,
        src: seedImg(seed, w, h),
        w,
        h,
        title: `${gen.vibe || "Custom"} ${gen.silhouette || "look"}`,
        tags,
        colors,
        price: rand(5000, 30000),
        creator: "You",
        likes: rand(0, 10),
      };
    });

    setRecentGen((prev) => [...newOnes, ...prev].slice(0, 30));
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <TopBar query={query} setQuery={setQuery} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-[1600px] mx-auto px-2 md:px-4">
        <div className="flex gap-4">
          <LeftRail activeTab={activeTab} setActiveTab={setActiveTab} />

          <div className="flex-1 min-h-[80vh]">
            {activeTab === "browse" && (
              <Feed refEl={feedRef} assets={filtered} onOpen={setSelected} onLike={toggleLike} />
            )}

            {activeTab === "trend" && (
              <Feed refEl={feedRef} assets={[...assets].sort((a,b)=>b.likes-a.likes)} onOpen={setSelected} onLike={toggleLike} />
            )}

            {activeTab === "create" && (
              <div className="max-w-5xl mx-auto p-4 space-y-8">
                <CreatorChat gen={gen} setGen={setGen} onGenerate={handleGenerate} genCount={genCount} setGenCount={setGenCount} />
                <div>
                  <h3 className="font-semibold mb-3">直近の生成</h3>
                  <InnerGrid assets={recentGen} />
                </div>
              </div>
            )}

            {activeTab === "saved" && (
              <div className="p-8 text-center text-zinc-500">Saved boards (MVP stub)</div>
            )}
          </div>
        </div>
      </div>

      {selected && !purchaseItem && (
        <DetailModal
          asset={selected}
          onClose={() => setSelected(null)}
          onLike={() => toggleLike(selected.id)}
          similar={similarTo(selected)}
          onPurchase={() => {
            setPurchaseItem(selected);
            setSelected(null);
          }}
        />
      )}

      {purchaseItem && (
        <PurchasePage
          asset={purchaseItem}
          onClose={() => setPurchaseItem(null)}
        />
      )}

      <footer className="px-4 py-10 text-center text-sm text-zinc-500">
        Pinterest-like feed ・ Separate Create tab ・ © OWM
      </footer>
    </div>
  );
}