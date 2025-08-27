import { useState, useRef, useEffect } from 'react';
import { GenParams } from '../lib/types';
import { PRESETS, SIGNATURES } from '../lib/data';
import { buildPrompt } from '../lib/prompt';
import { v4 as uuidv4 } from 'uuid';

interface CreatorChatProps {
  gen: GenParams;
  setGen: (g: GenParams) => void;
  onGenerate: (count?: number) => void;
  genCount: number;
  setGenCount: (n: number) => void;
}

interface GenerationStatus {
  jobId?: string;
  status?: string;
  progress?: number;
  resultUrls?: string[];
  error?: any;
}

interface TodayPreset {
  id: string;
  label: string;
  vibe: string;
  palette: string;
  silhouette: string;
  season: string;
  sampleUrl?: string;
}

function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-sm border transition ${
      selected ? "bg-black text-white border-black" : "bg-white hover:bg-black/5"
    }`}>
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-4 bg-white">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
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

// Helper functions for generation parameters
function getGenerationParams(g: GenParams, mode: 'quick' | 'pro') {
  const axis = g.axisCleanBold ?? 50;
  
  if (mode === 'quick') {
    return {
      s: 50 + Math.round(axis * 2.0), // 50-250
      q: 1,
      quality: "standard"
    };
  } else {
    return {
      s: 100 + Math.round(axis * 2.5), // 100-350  
      q: 2,
      quality: "high"
    };
  }
}

export function CreatorChat({ gen, setGen, onGenerate, genCount, setGenCount }: CreatorChatProps) {
  const [step, setStep] = useState<number>(1);
  const total = 4;
  
  // API state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({});
  const [todayPresets, setTodayPresets] = useState<TodayPreset[]>([]);
  
  // Long press state
  const lpTimer = useRef<number | null>(null);
  const lpFired = useRef<boolean>(false);
  const inFlightRequests = useRef<Map<string, boolean>>(new Map());
  
  const LP_MS = 600;

  // Load today's presets on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/trends')
      .then(res => res.json())
      .then(data => setTodayPresets(data))
      .catch(err => console.error("Failed to load today's presets:", err));
  }, []);

  const s = (k: keyof GenParams, v?: string | number) => setGen({ ...gen, [k]: (gen as any)[k] === v ? undefined : (v as any) });
  
  const applyPreset = (preset: any) => {
    setGen({ ...gen, vibe: preset.vibe, palette: preset.palette, silhouette: preset.silhouette, season: preset.season });
  };

  const prev = () => setStep((x) => Math.max(1, x - 1));

  // Pointer event handlers for unified touch/mouse support
  const startLP = () => {
    if (isGenerating || lpTimer.current) return;
    
    lpFired.current = false;
    lpTimer.current = window.setTimeout(() => {
      lpFired.current = true;
      handleGeneration('pro');
    }, LP_MS);
  };
  
  const cancelLP = () => {
    if (lpTimer.current) {
      window.clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  };

  const handlePointerUp = (mode: 'quick' | 'pro') => {
    if (isGenerating) return;
    
    cancelLP();
    
    // If long press fired, don't send quick
    if (lpFired.current) {
      lpFired.current = false;
      return;
    }
    
    // Send quick generation
    if (mode === 'quick') {
      handleGeneration('quick');
    }
  };

  const handleGeneration = async (mode: 'quick' | 'pro') => {
    if (isGenerating) return;
    
    const idempotencyKey = uuidv4();
    
    // Prevent duplicate requests
    if (inFlightRequests.current.has(idempotencyKey)) return;
    inFlightRequests.current.set(idempotencyKey, true);
    
    setIsGenerating(true);
    setGenerationStatus({ status: 'queued', progress: 0 });
    
    try {
      // Call generation API
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode,
          count: genCount,
          params: gen,
          aspectRatio: '3:4', // Default aspect ratio
          idempotencyKey
        })
      });
      
      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }
      
      const { jobId } = await response.json();
      setGenerationStatus({ jobId, status: 'queued', progress: 0 });
      
      // Start SSE connection for progress updates
      const eventSource = new EventSource(`http://localhost:3001/api/status/stream?id=${jobId}`);
      
      eventSource.onmessage = (event) => {
        console.log('SSE message:', event.data);
      };
      
      eventSource.addEventListener('connect', (event) => {
        console.log('SSE connected:', event.data);
      });
      
      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        setGenerationStatus(prev => ({ ...prev, ...data }));
      });
      
      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        setGenerationStatus(prev => ({ ...prev, status: 'completed', resultUrls: data.urls }));
        setIsGenerating(false);
        eventSource.close();
        
        // Call the original onGenerate callback with the results
        if (data.urls?.length > 0) {
          onGenerate(data.urls);
        }
        
        inFlightRequests.current.delete(idempotencyKey);
      });
      
      eventSource.addEventListener('error', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        setGenerationStatus(prev => ({ ...prev, ...data }));
        setIsGenerating(false);
        eventSource.close();
        inFlightRequests.current.delete(idempotencyKey);
      });
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsGenerating(false);
        setGenerationStatus(prev => ({ ...prev, error: 'Connection error' }));
        eventSource.close();
        inFlightRequests.current.delete(idempotencyKey);
      };
      
    } catch (error: any) {
      console.error('Generation error:', error);
      setIsGenerating(false);
      setGenerationStatus({ error: error.message });
      inFlightRequests.current.delete(idempotencyKey);
    }
  };

  const currentParams = getGenerationParams(gen, 'quick');
  const proParams = getGenerationParams(gen, 'pro');

  return (
    <div className="space-y-4">
      <StepIndicator step={step} total={total} />

      {step === 1 && (
        <Section title="まずはワンタップ（プリセット）">
          <div className="text-sm text-zinc-500 mb-2">時間がないときはこれでOK。あとから微調整できます。</div>
          <HScroll>
            {/* Today's presets first */}
            {todayPresets.map((preset) => (
              <button 
                key={preset.id} 
                onClick={() => applyPreset(preset)}
                onPointerDown={startLP}
                onPointerUp={() => handlePointerUp('quick')}
                onPointerLeave={cancelLP}
                onPointerCancel={cancelLP}
                disabled={isGenerating}
                className={`shrink-0 w-40 h-24 rounded-xl border text-left p-3 ${
                  isGenerating 
                    ? 'bg-gray-100 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-br from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 border-orange-200'
                }`}
                style={{ pointerEvents: isGenerating ? 'none' : 'auto' }}
              >
                <div className="text-sm font-medium text-orange-700 truncate">{preset.label}</div>
                <div className="mt-1 text-xs text-orange-600">{preset.vibe} · {preset.palette} · {preset.silhouette}</div>
                <div className="mt-2 text-[10px] text-orange-500">長押しで即生成（{genCount}件）</div>
              </button>
            ))}
            
            {/* Regular presets */}
            {PRESETS.map((p) => (
              <button 
                key={p.id} 
                onClick={() => applyPreset(p)}
                onPointerDown={startLP}
                onPointerUp={() => handlePointerUp('quick')}
                onPointerLeave={cancelLP}
                onPointerCancel={cancelLP}
                disabled={isGenerating}
                className={`shrink-0 w-40 h-24 rounded-xl border text-left p-3 ${
                  isGenerating 
                    ? 'bg-gray-100 cursor-not-allowed opacity-50' 
                    : 'bg-zinc-50 hover:bg-zinc-100'
                }`}
                style={{ pointerEvents: isGenerating ? 'none' : 'auto' }}
              >
                <div className="text-sm font-medium truncate">{p.label}</div>
                <div className="mt-1 text-xs text-zinc-500">{p.vibe} · {p.palette} · {p.silhouette}</div>
                <div className="mt-2 text-[10px] text-zinc-400">長押しで即生成（{genCount}件）</div>
              </button>
            ))}
            <button 
              onClick={() => setGen({})} 
              disabled={isGenerating}
              className={`shrink-0 w-28 h-24 rounded-xl border text-sm ${
                isGenerating 
                  ? 'bg-gray-100 cursor-not-allowed opacity-50' 
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              リセット
            </button>
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
          <div className="mt-2 text-xs text-zinc-500">※ "自分の色"は実際の色ではなく、個性の方向性。後ろのステップの「シグネチャ」でさらに一滴追加できます。</div>
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

      {/* Generation Status */}
      {isGenerating && (
        <Section title="生成中">
          <div className="space-y-2">
            <div className="text-sm">Job ID: {generationStatus.jobId}</div>
            <div className="text-sm">Status: {generationStatus.status}</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${generationStatus.progress || 0}%` }}
              />
            </div>
            <div className="text-xs text-gray-600">Progress: {generationStatus.progress || 0}%</div>
            {generationStatus.error && (
              <div className="text-sm text-red-600">Error: {generationStatus.error}</div>
            )}
          </div>
        </Section>
      )}

      {/* Generation Summary */}
      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
        <div className="font-medium mb-1">生成サマリー:</div>
        <div>Quick: quality={currentParams.quality}, --s={currentParams.s}, --q={currentParams.q}</div>
        <div>Pro: quality={proParams.quality}, --s={proParams.s}, --q={proParams.q}</div>
        <div>Aspect: 3:4 (縦)</div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-2 z-10">
        <div className="rounded-full bg-white border shadow flex items-center justify-between px-2 py-1 gap-2">
          <button 
            onClick={prev} 
            disabled={isGenerating}
            className="px-3 py-2 text-sm rounded-full hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            戻る
          </button>

          {/* Count selector */}
          <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
            {[4,6,9].map((n) => (
              <button 
                key={n} 
                onClick={() => setGenCount(n)} 
                disabled={isGenerating}
                className={`px-2 py-1 rounded-full text-sm ${genCount === n ? "bg-white shadow" : "opacity-70"} disabled:opacity-30`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="text-xs text-zinc-600 truncate max-w-[35%]">
            {buildPrompt(gen) || "選択するとここに要約が表示されます"}
          </div>

          <button
            onPointerDown={startLP}
            onPointerUp={() => handlePointerUp('quick')}
            onPointerLeave={cancelLP}
            onPointerCancel={cancelLP}
            disabled={isGenerating}
            className={`px-4 py-2 rounded-full text-white ${
              isGenerating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-black hover:bg-gray-800'
            }`}
            title="タップでQuick生成 / 長押し(600ms)でPro生成"
            style={{ pointerEvents: isGenerating ? 'none' : 'auto' }}
            aria-busy={isGenerating}
          >
            {isGenerating ? '生成中...' : '生成'}
          </button>
        </div>
      </div>
    </div>
  );
}