import { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, GenParams } from './lib/types';
import { buildPrompt } from './lib/prompt';
import { rand, pick, uniq, seedImg, randomPrice } from './lib/util';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { TopBar } from './components/TopBar';
import { LeftRail } from './components/LeftRail';
import { Feed, InnerGrid } from './components/Feed';
import { DetailModal } from './components/DetailModal';
import { CreatorChat } from './components/CreatorChat';
import { PurchasePage } from './components/PurchasePage';
import { ChatDesigner } from './pages/create/ChatDesigner';
import { Creator } from './pages/create/Creator';
import { PublishForm } from './pages/publish/PublishForm';
import { UserGallery } from './components/UserGallery';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Icons } from './components/Icons';

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
    price: randomPrice(),
    creator: pick(["Kai Studio", "Mori Atelier", "DRA Lab", "OWM Creator", "Atelier 37"]),
    likes: rand(5, 200),
    isAd,
  };
}

async function fetchCatalogAssets(): Promise<Asset[]> {
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('Failed to fetch catalog');
    const data = await response.json();
    return data.images || [];
  } catch (error) {
    console.error('Failed to load catalog:', error);
    // フォールバック: ダミーデータを生成
    return makeInitialAssets();
  }
}

function makeInitialAssets(n = 30): Asset[] {
  return Array.from({ length: n }).map((_, i) => sizedAsset(i));
}

function AppContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"browse" | "trend" | "create" | "chat" | "creator" | "saved" | "gallery" | "analytics">("browse");
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<Asset | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const [gen, setGen] = useState<GenParams>({});
  const [recentGen, setRecentGen] = useState<Asset[]>([]);
  const [genCount, setGenCount] = useState<number>(6);
  const [savedItems, setSavedItems] = useState<Asset[]>([]);
  const [publishingAsset, setPublishingAsset] = useState<Asset | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q)) ||
      (a.colors && a.colors.some((c) => c.toLowerCase().includes(q)))
    );
  }, [assets, query]);

  // カタログ画像を読み込み
  useEffect(() => {
    async function loadCatalog() {
      const catalogAssets = await fetchCatalogAssets();
      setAssets(catalogAssets);
    }
    loadCatalog();
  }, []);

  // 保存済みアイテムを読み込み
  useEffect(() => {
    if (user && activeTab === 'saved') {
      loadSavedItems();
    }
  }, [user, activeTab]);

  const loadSavedItems = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/saved?user_id=${user.id}`);
      if (response.ok) {
        const savedData = await response.json();
        const items = savedData.map((item: any) => ({
          id: item.images.id,
          src: item.images.r2_url,
          title: item.images.title,
          tags: item.images.tags || [],
          colors: item.images.colors || [],
          price: item.images.price,
          likes: 0, // We'll need to get this from likes table
          w: item.images.width,
          h: item.images.height
        }));
        setSavedItems(items);
      }
    } catch (error) {
      console.error('Error loading saved items:', error);
    }
  };

  // Add preconnect links for image CDN
  useEffect(() => {
    // R2 public URL
    const r2PublicUrl = 'https://pub-4215f2149d4e4f369c2bde9f2769dfd4.r2.dev';
    
    // Add preconnect link
    const preconnectLink = document.createElement('link');
    preconnectLink.rel = 'preconnect';
    preconnectLink.href = r2PublicUrl;
    preconnectLink.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectLink);
    
    // Add dns-prefetch as fallback
    const dnsPrefetchLink = document.createElement('link');
    dnsPrefetchLink.rel = 'dns-prefetch';
    dnsPrefetchLink.href = r2PublicUrl;
    document.head.appendChild(dnsPrefetchLink);
    
    return () => {
      if (document.head.contains(preconnectLink)) {
        document.head.removeChild(preconnectLink);
      }
      if (document.head.contains(dnsPrefetchLink)) {
        document.head.removeChild(dnsPrefetchLink);
      }
    };
  }, []);

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
    const allAvailableAssets = [...assets, ...recentGen];
    const pool = allAvailableAssets.filter((a) => a.id !== asset.id && a.tags.some((t) => tagSet.has(t)));
    if (pool.length < limit) {
      const rest = allAvailableAssets.filter((a) => a.id !== asset.id && !pool.includes(a));
      return [...pool, ...rest].slice(0, limit);
    }
    return pool.slice(0, limit);
  };

  const toggleLike = async (id: string) => {
    if (!user) {
      console.log('User must be logged in to like');
      return;
    }
    
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          image_id: id
        })
      });
      
      if (response.ok) {
        const { liked } = await response.json();
        
        // Update local state
        setAssets((prev) => prev.map((a) => 
          a.id === id ? { 
            ...a, 
            liked: liked,
            likes: liked ? (a.likes || 0) + 1 : Math.max((a.likes || 0) - 1, 0)
          } : a
        ));
        
        setRecentGen((prev) => prev.map((a) => 
          a.id === id ? { 
            ...a, 
            liked: liked,
            likes: liked ? (a.likes || 0) + 1 : Math.max((a.likes || 0) - 1, 0)
          } : a
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleGenerate = (images?: Asset[], isPublic: boolean = true, count?: number) => {
    // If images are provided (from actual generation), use them
    if (images && images.length > 0) {
      console.log(`[Generate] Received ${images.length} generated images, isPublic: ${isPublic}`);
      
      // Add the generated images to recent generation list
      setRecentGen((prev) => [...images, ...prev].slice(0, 30));
      
      // If public, also add to main assets feed
      if (isPublic) {
        setAssets((prev) => [...images, ...prev]);
      }
      
      return;
    }
    
    // Fallback: generate placeholder assets (for testing)
    const promptStr = buildPrompt(gen);
    console.log("[Generate] Creating placeholder assets, prompt:", promptStr);

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
        price: randomPrice(),
        creator: "You",
        likes: rand(0, 10),
        type: 'generated' as const,
        isPublic
      };
    });

    setRecentGen((prev) => [...newOnes, ...prev].slice(0, 30));
    
    // If public, also add to main feed
    if (isPublic) {
      setAssets((prev) => [...newOnes, ...prev]);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <TopBar query={query} setQuery={setQuery} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="w-full">
        <div className="flex gap-2 lg:gap-4">
          <LeftRail activeTab={activeTab} setActiveTab={setActiveTab} />

          <div className="flex-1 min-h-[80vh]">
            {activeTab === "browse" && (
              <Feed refEl={feedRef} assets={filtered} onOpen={setSelected} onLike={toggleLike} />
            )}

            {activeTab === "trend" && (
              <Feed refEl={feedRef} assets={[...assets].sort((a,b)=>(b.likes||0)-(a.likes||0))} onOpen={setSelected} onLike={toggleLike} />
            )}

            {activeTab === "create" && (
              <div className="max-w-5xl mx-auto p-4 space-y-8">
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => setActiveTab("chat")}
                    className="flex-1 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all flex flex-col items-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <Icons.Message size={18} />
                      AIチャット生成
                    </div>
                    <div className="text-xs opacity-90">対話形式で簡単作成</div>
                  </button>
                  <button
                    onClick={() => {/* Keep current tab */}}
                    className="flex-1 p-4 bg-white border-2 border-gray-200 rounded-xl font-medium hover:border-gray-300 transition-all flex flex-col items-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <Icons.Palette size={18} />
                      詳細設定生成
                    </div>
                    <div className="text-xs text-gray-600">パラメータを細かく調整</div>
                  </button>
                </div>
                
                <CreatorChat 
                  gen={gen} 
                  setGen={setGen} 
                  onGenerate={handleGenerate} 
                  genCount={genCount} 
                  setGenCount={setGenCount}
                  onSelectVariation={setSelected}
                />
                <div>
                  <h3 className="font-semibold mb-3">直近の生成</h3>
                  <InnerGrid assets={recentGen} />
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <ChatDesigner 
                onGenerate={handleGenerate}
                onSelectVariation={setSelected}
              />
            )}

            {activeTab === "creator" && (
              <Creator 
                onGenerate={handleGenerate}
              />
            )}

            {activeTab === "saved" && (
              <div className="max-w-5xl mx-auto p-4">
                <h2 className="text-2xl font-semibold mb-6">保存済み</h2>
                {!user ? (
                  <div className="p-8 text-center text-zinc-500">
                    保存機能を使用するにはログインが必要です
                  </div>
                ) : savedItems.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    まだ保存されたアイテムがありません
                  </div>
                ) : (
                  <InnerGrid assets={savedItems} />
                )}
              </div>
            )}

            {activeTab === "gallery" && (
              <UserGallery 
                onPublishToGallery={(asset) => {
                  setPublishingAsset(asset);
                }}
              />
            )}

            {activeTab === "analytics" && (
              <div className="max-w-7xl mx-auto p-4">
                <AnalyticsDashboard userId={user?.id || ''} />
              </div>
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
          onSelectSimilar={(asset) => setSelected(asset)}
          onPublishToGallery={(asset) => {
            console.log('Publishing to gallery:', asset);
            setPublishingAsset(asset);
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

      {publishingAsset && (
        <PublishForm
          asset={publishingAsset}
          onPublish={(publishedAsset) => {
            console.log('Asset published:', publishedAsset);
            // Add to public feed
            setAssets(prev => [publishedAsset, ...prev]);
            setPublishingAsset(null);
            // Show success message
            alert('🎉 作品が出品されました！法人ユーザーが購入できるようになりました。');
          }}
          onCancel={() => setPublishingAsset(null)}
        />
      )}

      <footer className="px-4 py-10 text-center text-sm text-zinc-500">
        2025 Open Wardrobe market ©OpenDesign
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}