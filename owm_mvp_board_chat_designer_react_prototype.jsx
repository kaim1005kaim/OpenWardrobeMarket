import React, { useMemo, useState, useEffect, useRef } from "react";

// =======
// OWM MVP — Pinterest-like Feed + Separate Create Tab (Mobile-first Creator)
//  - Feed view mirrors Pinterest UX: top search, left rail, masonry pins, hover actions
//  - Create tab ONLY shows the generator (never rendered in feed)
//  - Safe prompt builder (safeJoin); fixed stray returns; no duplicate defs
//  - Columns: 3 (sm+) / 5 (lg+), Save button = ORANGE; minimal heart icon
//  - Trend tab; minimal icons; tall-card bias with some square/wide
//  - Creator: presets, persona sliders ("自分の色" as individuality axes), signature, free text
//  - Long-press quick-generate, count selector (4/6/9)
//  - Lightweight dev tests in console
// =======

// ---------- Types ----------
type Asset = {
  id: string;
  src: string;
  w: number;
  h: number;
  title: string;
  tags: string[];
  colors: string[];
  price?: number;
  creator?: string;
  likes: number;
  isAd?: boolean;
};

type GenParams = {
  silhouette?: string;
  palette?: string;
  vibe?: string;
  season?: string;
  fabric?: string;
  priceBand?: string;
  notes?: string;
  signature?: string; // user's personal touch (e.g., contrast stitching, asymmetry)
  // Personal tuning ("自分の色" = individuality axes, not literal colors)
  axisCleanBold?: number;        // 0=clean, 100=bold
  axisClassicFuture?: number;    // 0=classic, 100=future
  axisSoftSharp?: number;        // 0=soft, 100=sharp
};

// ---------- Helpers ----------
const seedImg = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

// Guarded join for prompt pieces
function safeJoin(parts: Array<string | undefined | null>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" | ");
}

// Map personal tuning sliders to short words
function personaWords(g: GenParams): string[] {
  const words: string[] = [];
  const axis = (val: number | undefined, low: string, mid: string, high: string) => {
    if (typeof val !== "number") return;
    if (val <= 33) words.push(low);
    else if (val >= 67) words.push(high);
    else words.push(mid);
  };
  axis(g.axisCleanBold, "clean", "balanced", "bold");
  axis(g.axisClassicFuture, "classic", "balanced", "future");
  axis(g.axisSoftSharp, "soft", "balanced", "sharp");
  const nonBalanced = words.filter((w) => w !== "balanced");
  return nonBalanced.length ? Array.from(new Set(nonBalanced)) : ["balanced"]; // keep one word when fully balanced
}

const baseTags = [
  "minimal", "street", "luxury", "outdoor", "workwear", "athleisure", "retro",
  "avantgarde", "genderless", "utility", "tailored", "y2k", "techwear",
];

const basePalettes = ["black", "white", "navy", "earth", "pastel", "neon", "monochrome"];

// ---------- Presets (ensure PRESETS is defined before use) ----------
const PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  vibe: string;
  palette: string;
  silhouette: string;
  season: string;
}> = [
  { id: "street_black", label: "ストリート黒", vibe: "street", palette: "black", silhouette: "oversized", season: "aw" },
  { id: "soft_minimal", label: "ソフトミニマル", vibe: "minimal", palette: "monochrome", silhouette: "relaxed", season: "ss" },
  { id: "outdoor_earth", label: "アウトドア土色", vibe: "outdoor", palette: "earth", silhouette: "straight", season: "ss" },
  { id: "tech_neon", label: "テック×ネオン", vibe: "techwear", palette: "neon", silhouette: "tailored", season: "aw" },
  { id: "retro_navy", label: "レトロネイビー", vibe: "retro", palette: "navy", silhouette: "cropped", season: "pre-fall" },
];

const SIGNATURES = [
  "contrast stitching",
  "asymmetric lines",
  "oversized pocket",
  "hidden placket",
  "panel blocking",
  "raw edge",
];

// One item builder with tall/square/wide mix
function sizedAsset(i: number): Asset {
  const r = Math.random();
  let w = 800, h = 1200; // tall default
  if (r < 0.60) { w = rand(700, 900); h = rand(1100, 1400); } // tall 60%
  else if (r < 0.85) { w = rand(900, 1200); h = w; }          // square 25%
  else { w = rand(1100, 1400); h = rand(700, 900); }          // wide 15%
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

// ---------- Dev Tests ----------
function runDevTests() {
  const logs: string[] = [];
  let passed = 0;
  let failed = 0;

  const t = (name: string, fn: () => void) => {
    try {
      fn();
      logs.push(`✅ ${name}`);
      passed++;
    } catch (e: any) {
      logs.push(`❌ ${name}: ${e?.message || e}`);
      failed++;
    }
  };

  // Existing tests — DO NOT CHANGE semantics
  t("safeJoin removes undefined/null/empty and trims", () => {
    const r = safeJoin([undefined, "  a  ", null, "", "b "]);
    if (r !== "a | b") throw new Error(`Expected "a | b", got "${r}"`);
  });

  t("buildPrompt with only vibe+silhouette", () => {
    const r = buildPrompt({ vibe: "minimal", silhouette: "tailored" });
    if (r !== "minimal fashion | tailored silhouette") throw new Error(r);
  });

  t("buildPrompt with notes only", () => {
    const r = buildPrompt({ notes: "hidden placket" });
    if (r !== "hidden placket") throw new Error(r);
  });

  t("buildPrompt with palette and blank season", () => {
    const r = buildPrompt({ palette: "black", season: undefined });
    if (r !== "black palette") throw new Error(r);
  });

  t("buildPrompt merges signature", () => {
    const r = buildPrompt({ vibe: "street", signature: "contrast stitching" });
    if (r !== "street fashion | contrast stitching") throw new Error(r);
  });

  // Persona mapping
  t("personaWords maps extremes", () => {
    const w1 = personaWords({ axisCleanBold: 0, axisClassicFuture: 100, axisSoftSharp: 70 });
    const expected = ["clean", "future", "sharp"];
    if (expected.some((x) => !w1.includes(x))) throw new Error(w1.join(","));
  });

  t("personaWords balanced collapses to single 'balanced'", () => {
    const w = personaWords({ axisCleanBold: 50, axisClassicFuture: 50, axisSoftSharp: 50 });
    if (!(w.length === 1 && w[0] === "balanced")) throw new Error(w.join(","));
  });

  // New: buildPrompt adds tones only when axes provided
  t("buildPrompt adds tones when axes present", () => {
    const r = buildPrompt({ vibe: "minimal", axisCleanBold: 80 });
    if (!r.includes("tone:bold") || !r.startsWith("minimal fashion")) throw new Error(r);
  });

  // New: no tones when axes absent
  t("buildPrompt has no tones when axes absent", () => {
    const r = buildPrompt({ vibe: "minimal" });
    if (r.includes("tone:")) throw new Error(r);
  });

  t("safeJoin yields non-empty seed when at least one piece valid", () => {
    const prompt = safeJoin([undefined, "black palette", " ", null]);
    if (!prompt) throw new Error("Prompt should be non-empty when parts contain a valid piece");
  });

  // New: PRESETS existence & shape
  t("PRESETS defined and valid shape", () => {
    if (!Array.isArray(PRESETS) || PRESETS.length < 5) throw new Error("PRESETS length");
    const req = ["id","label","vibe","palette","silhouette","season"] as const;
    PRESETS.forEach((p) => {
      req.forEach((k) => {
        if (!(k in p) || typeof (p as any)[k] !== "string" || !(p as any)[k]) {
          throw new Error(`PRESETS item missing ${k}`);
        }
      });
    });
  });

  return { passed, failed, logs };
}

// ---------- Main ----------
export default function App() {
  const [activeTab, setActiveTab] = useState<"browse" | "trend" | "create" | "saved">("browse");
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<Asset[]>(() => makeInitialAssets());
  const [selected, setSelected] = useState<Asset | null>(null);
  const [testSummary, setTestSummary] = useState<{ passed: number; failed: number } | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Generator state (only used in Create tab)
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

  // --- Infinite scroll (MVP stub) ---
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
    const hasAxes = [gen.axisCleanBold, gen.axisClassicFuture, gen.axisSoftSharp].some((v) => typeof v === "number");
    const tones = hasAxes ? personaWords(gen).map((w) => `tone:${w}`) : [];
    const promptStr = safeJoin([
      gen.vibe && `${gen.vibe} fashion`,
      ...tones,
      gen.silhouette && `${gen.silhouette} silhouette`,
      gen.palette && `${gen.palette} palette`,
      gen.season && `${gen.season} season`,
      gen.fabric && `${gen.fabric} fabric`,
      gen.priceBand && `${gen.priceBand} band`,
      gen.signature,
      gen.notes
    ]);
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

    setAssets((prev) => [...newOnes, ...prev]);
    setRecentGen((prev) => [...newOnes, ...prev].slice(0, 30));
    setActiveTab("browse"); // return to feed after generation
  };

  // Run dev tests once on mount
  useEffect(() => {
    const { passed, failed, logs } = runDevTests();
    setTestSummary({ passed, failed });
    logs.forEach((l) => console.log("[TEST]", l));
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <TopBar query={query} setQuery={setQuery} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-[1600px] mx-auto px-2 md:px-4">
        <div className="flex gap-4">
          {/* Left rail (Pinterest-like) */}
          <LeftRail activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Main area */}
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

      {selected && (
        <DetailModal
          asset={selected}
          onClose={() => setSelected(null)}
          onLike={() => toggleLike(selected.id)}
          similar={similarTo(selected)}
        />
      )}

      <footer className="px-4 py-10 text-center text-sm text-zinc-500">
        Pinterest-like feed · Separate Create tab · © OWM
        {testSummary && (
          <span className="ml-2">
            · Tests: {testSummary.passed} passed{testSummary.failed ? `, ${testSummary.failed} failed` : ""}
          </span>
        )}
      </footer>
    </div>
  );
}

// ---------- Top Bar & Left Rail ----------
function TopBar({
  query,
  setQuery,
  activeTab,
  setActiveTab,
}: {
  query: string;
  setQuery: (v: string) => void;
  activeTab: "browse" | "trend" | "create" | "saved";
  setActiveTab: (t: "browse" | "trend" | "create" | "saved") => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
      <div className="max-w-[1600px] mx-auto px-2 md:px-4 py-2 flex items-center gap-2">
        <div className="flex items-center gap-2 pr-2">
          <div className="w-8 h-8 rounded-xl bg-black" />
          <nav className="hidden md:flex gap-1">
            <TabBtn label="ホーム" active={activeTab === "browse"} onClick={() => setActiveTab("browse")} />
            <TabBtn label="トレンド" active={activeTab === "trend"} onClick={() => setActiveTab("trend")} />
            <TabBtn label="作成" active={activeTab === "create"} onClick={() => setActiveTab("create")} />
            <TabBtn label="保存済み" active={activeTab === "saved"} onClick={() => setActiveTab("saved")} />
          </nav>
        </div>

        <div className="flex-1">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full bg-zinc-100 pl-11 pr-4 py-2 md:py-2.5 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="検索する"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2">🔎</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-2">
          <IconBtn ariaLabel="通知">•</IconBtn>
          <IconBtn ariaLabel="メッセージ">•</IconBtn>
          <div className="w-8 h-8 rounded-full bg-zinc-300" title="プロフィール" />
        </div>
      </div>
    </header>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium ${
        active ? "bg-black text-white" : "hover:bg-black/5"
      }`}
    >
      {label}
    </button>
  );
}

function LeftRail({
  activeTab,
  setActiveTab,
}: {
  activeTab: "browse" | "trend" | "create" | "saved";
  setActiveTab: (t: "browse" | "trend" | "create" | "saved") => void;
}) {
  return (
    <aside className="hidden lg:flex lg:sticky lg:top-16 flex-col items-center gap-3 pt-6 w-14 shrink-0">
      <RailIcon label="ホーム" active={activeTab === "browse"} onClick={() => setActiveTab("browse")}>●</RailIcon>
      <RailIcon label="トレンド" active={activeTab === "trend"} onClick={() => setActiveTab("trend")}>★</RailIcon>
      <RailIcon label="作成" active={activeTab === "create"} onClick={() => setActiveTab("create")}>＋</RailIcon>
      <RailIcon label="保存" active={activeTab === "saved"} onClick={() => setActiveTab("saved")}>⎙</RailIcon>
      <RailIcon label="プロフィール">○</RailIcon>
      <RailIcon label="設定">⚙</RailIcon>
    </aside>
  );
}

function RailIcon({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 grid place-items-center rounded-full border text-base ${
        active ? "bg-black text-white border-black" : "hover:bg-black/5"
      }`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      aria-label={ariaLabel}
      className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"
    >
      {children}
    </button>
  );
}

// ---------- Minimal Heart Icon ----------
function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 20.5s-6.5-4.06-9.2-7.2C1.2 11.5 2 8.5 4.6 7.3 7 6.2 9 7.1 12 9.8c3-2.7 5-3.6 7.4-2.5 2.6 1.2 3.4 4.2 1.8 6-2.7 3.14-9.2 7.2-9.2 7.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------- Feed (Masonry pins) ----------
function Feed({ refEl, assets, onOpen, onLike }: { refEl: React.MutableRefObject<HTMLDivElement | null>; assets: Asset[]; onOpen: (a: Asset) => void; onLike: (id: string) => void }) {
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

function InnerGrid({ assets }: { assets: Asset[] }) {
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

function PinCard({ asset, onOpen, onLike }: { asset: Asset; onOpen: (a: Asset) => void; onLike: (id: string) => void }) {
  return (
    <article className="mb-4 break-inside-avoid" style={{ breakInside: "avoid" }}>
      <div className="relative group rounded-2xl overflow-hidden">
        <img src={asset.src} alt={asset.title} className="w-full h-auto object-cover" />
        {/* Hover actions */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100 transition">
          <div className="flex justify-end">
            <button className="pointer-events-auto px-3 py-1.5 rounded-full bg-orange-500 text-white text-sm font-medium shadow">
              保存
            </button>
          </div>
          <div className="flex justify-between">
            <div className="flex gap-1.5">
              {asset.colors.slice(0, 2).map((c) => (
                <span key={c} title={c} className="w-3 h-3 rounded-full border shadow" style={{ background: colorToCss(c) }} />
              ))}
            </div>
            <div className="flex gap-1">
              <button className="pointer-events-auto px-2 py-1 rounded-full bg-white/95 border text-sm" onClick={() => onLike(asset.id)}>
                <span className="inline-flex items-center gap-1"><HeartIcon className="w-4 h-4" />{asset.likes}</span>
              </button>
              <button className="pointer-events-auto px-2 py-1 rounded-full bg-white/95 border text-sm" onClick={() => onOpen(asset)}>…</button>
            </div>
          </div>
        </div>
      </div>
      {/* Meta row below image */}
      <div className="px-1.5 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-300" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{asset.title}</div>
            <div className="text-xs text-zinc-500 truncate">
              {asset.isAd ? "広告 · Promoted" : asset.creator || "Creator"}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ---------- Detail Modal ----------
function DetailModal({ asset, onClose, onLike, similar }: { asset: Asset; onClose: () => void; onLike: () => void; similar: Asset[] }) {
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
              <button className="px-3 py-1.5 rounded-lg border bg-black text-white border-black">保存</button>
            </div>
          </div>

          <div className="text-sm text-zinc-600">Colors: {asset.colors.join(", ")}</div>
          {asset.price && (
            <div className="text-lg font-medium">Buy (std. license): ¥{asset.price.toLocaleString()}</div>
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
            {asset.isAd ? "広告 · このプロモーションは例示です" : "出品者例 · ライセンスは購入時に発行"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Creator Chat (separate tab) ----------
function CreatorChat({ gen, setGen, onGenerate, genCount, setGenCount }: { gen: GenParams; setGen: (g: GenParams) => void; onGenerate: (count?: number) => void; genCount: number; setGenCount: (n: number) => void }) {
  // Mobile-first stepper (one-hand friendly)
  const [step, setStep] = useState<number>(1);
  const total = 4;

  const s = (k: keyof GenParams, v?: string | number) => setGen({ ...gen, [k]: (gen as any)[k] === v ? undefined : (v as any) });
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setGen({ ...gen, vibe: p.vibe, palette: p.palette, silhouette: p.silhouette, season: p.season });
  };

  const next = () => setStep((x) => Math.min(total, x + 1));
  const prev = () => setStep((x) => Math.max(1, x - 1));

  const Chip = ({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-sm border transition ${selected ? "bg-black text-white border-black" : "bg-white hover:bg-black/5"}`}>{children}</button>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border p-4 bg-white">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );

  // long-press quick-generate
  const lpTimer = useRef<number | null>(null);
  const lpFired = useRef<boolean>(false);
  const LP_MS = 600;
  const startLP = () => {
    if (lpTimer.current) window.clearTimeout(lpTimer.current);
    lpFired.current = false;
    lpTimer.current = window.setTimeout(() => {
      lpFired.current = true;
      onGenerate(genCount);
    }, LP_MS);
  };
  const cancelLP = () => {
    if (lpTimer.current) window.clearTimeout(lpTimer.current);
  };

  return (
    <div className="space-y-4">
      <StepIndicator step={step} total={total} />

      {step === 1 && (
        <Section title="まずはワンタップ（プリセット）">
          <div className="text-sm text-zinc-500 mb-2">時間がないときはこれでOK。あとから微調整できます。</div>
          <HScroll>
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} onMouseDown={startLP} onMouseUp={cancelLP} onMouseLeave={cancelLP} onTouchStart={startLP} onTouchEnd={cancelLP} className="shrink-0 w-40 h-24 rounded-xl border bg-zinc-50 hover:bg-zinc-100 text-left p-3">
                <div className="text-sm font-medium truncate">{p.label}</div>
                <div className="mt-1 text-xs text-zinc-500">{p.vibe} · {p.palette} · {p.silhouette}</div>
                <div className="mt-2 text-[10px] text-zinc-400">長押しで即生成（{genCount}件）</div>
              </button>
            ))}
            <button onClick={() => setGen({})} className="shrink-0 w-28 h-24 rounded-xl border bg-white text-sm">リセット</button>
          </HScroll>
        </Section>
      )}

      {step === 2 && (
        <Section title="形・雰囲気を選ぶ">
          <div className="mb-2 text-sm text-zinc-500">迷ったらどれか1つだけでOK。</div>
          <div className="grid grid-cols-3 gap-2">
            {(["tailored","oversized","relaxed","straight","flare","cropped"] as const).map((o) => (
              <Chip key={o} selected={gen.silhouette === o} onClick={() => s("silhouette", o)}>{o}</Chip>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["minimal","street","luxury","utility","techwear","retro","avantgarde"] as const).map((o) => (
              <Chip key={o} selected={gen.vibe === o} onClick={() => s("vibe", o)}>{o}</Chip>
            ))}
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title="自分の色（個性チューニング）">
          <Slider label="Clean → Bold" value={gen.axisCleanBold ?? 50} onChange={(v) => setGen({ ...gen, axisCleanBold: v })} />
          <Slider label="Classic → Future" value={gen.axisClassicFuture ?? 50} onChange={(v) => setGen({ ...gen, axisClassicFuture: v })} />
          <Slider label="Soft → Sharp" value={gen.axisSoftSharp ?? 50} onChange={(v) => setGen({ ...gen, axisSoftSharp: v })} />
          <div className="mt-2 text-xs text-zinc-500">※ “自分の色”は実際の色ではなく、個性の方向性。後ろのステップの「シグネチャ」でさらに一滴追加できます。</div>
        </Section>
      )}

      {step === 4 && (
        <Section title="仕上げ（季節・素材・シグネチャ・フリーワード）">
          <div className="flex flex-wrap gap-2 mb-2">
            {(["ss","aw","resort","pre-fall"] as const).map((o) => (
              <Chip key={o} selected={gen.season === o} onClick={() => s("season", o)}>{o}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {(["wool","cotton","linen","nylon","leather","denim","silk"] as const).map((o) => (
              <Chip key={o} selected={gen.fabric === o} onClick={() => s("fabric", o)}>{o}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {(["entry","mid","premium","luxe"] as const).map((o) => (
              <Chip key={o} selected={gen.priceBand === o} onClick={() => s("priceBand", o)}>{o}</Chip>
            ))}
          </div>
          <div className="mt-2">
            <div className="text-sm text-zinc-500 mb-1">Myシグネチャ（タップで追加）</div>
            <div className="flex flex-wrap gap-2">
              {SIGNATURES.map((sg) => (
                <Chip key={sg} selected={gen.signature === sg} onClick={() => s("signature", sg)}>{sg}</Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-zinc-500 mb-1">フリーワード（任意）</div>
            <textarea value={gen.notes || ""} onChange={(e) => setGen({ ...gen, notes: e.target.value })} placeholder="例) gentle drape, asymmetric zip" className="w-full border rounded-xl px-3 py-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
        </Section>
      )}

      {/* Sticky action bar (mobile one-hand) */}
      <div className="sticky bottom-2 z-10">
        <div className="rounded-full bg-white border shadow flex items-center justify-between px-2 py-1 gap-2">
          <button onClick={prev} className="px-3 py-2 text-sm rounded-full hover:bg-black/5">戻る</button>

          {/* Count selector */}
          <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
            {[4,6,9].map((n) => (
              <button key={n} onClick={() => setGenCount(n)} className={`px-2 py-1 rounded-full text-sm ${genCount === n ? "bg-white shadow" : "opacity-70"}`}>{n}</button>
            ))}
          </div>

          <div className="text-xs text-zinc-600 truncate max-w-[35%]">
            {buildPrompt(gen) || "選択するとここに要約が表示されます"}
          </div>

          <button
            onClick={(e) => { if (lpFired.current) { lpFired.current = false; return; } onGenerate(genCount); }}
            onMouseDown={startLP}
            onMouseUp={cancelLP}
            onMouseLeave={cancelLP}
            onTouchStart={startLP}
            onTouchEnd={cancelLP}
            className="px-4 py-2 rounded-full bg-black text-white"
            title="タップで生成 / 長押しで即生成"
          >
            生成
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-zinc-600">{label}</div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="flex-1" />
      <div className="w-10 text-right text-xs text-zinc-500">{value}</div>
    </div>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full ${i + 1 <= step ? "bg-black" : "bg-zinc-300"}`} />
      ))}
    </div>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">{children}</div>;
}

function colorToCss(c: string) {
  switch (c) {
    case "black": return "#0a0a0a";
    case "white": return "#ffffff";
    case "navy": return "#0f1d3a";
    case "earth": return "#8b6b4f";
    case "pastel": return "#ffd1dc";
    case "neon": return "#c8ff00";
    case "monochrome": return "#c7c7c7";
    default: return c;
  }
}

function buildPrompt(g: GenParams) {
  const hasAxes = [g.axisCleanBold, g.axisClassicFuture, g.axisSoftSharp].some((v) => typeof v === "number");
  const tones = hasAxes ? personaWords(g).map((w) => `tone:${w}`) : [];
  return safeJoin([
    g.vibe && `${g.vibe} fashion`,
    ...tones,
    g.silhouette && `${g.silhouette} silhouette`,
    g.palette && `${g.palette} palette`,
    g.season && `${g.season} season`,
    g.fabric && `${g.fabric} fabric`,
    g.priceBand && `${g.priceBand} band`,
    g.signature,
    g.notes
  ]);
}
