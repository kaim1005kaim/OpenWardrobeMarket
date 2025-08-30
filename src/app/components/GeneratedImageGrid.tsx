import { Asset } from '../lib/types';

interface GeneratedImageGridProps {
  variations: Asset[];
  onSelectVariation: (asset: Asset) => void;
  onUpscale?: (asset: Asset, index: number) => void;
  onVariation?: (asset: Asset, index: number) => void;
}

export function GeneratedImageGrid({ variations, onSelectVariation, onVariation }: GeneratedImageGridProps) {
  console.log('GeneratedImageGrid rendered with:', { variationCount: variations.length });

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main grid container */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-4 gap-3 p-6">
          {variations.slice(0, 4).map((variation, index) => (
            <div
              key={variation.id}
              className="relative group cursor-pointer transform transition-all duration-200 hover:scale-[1.02]"
              onClick={() => onSelectVariation(variation)}
            >
              {/* Individual image display */}
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-zinc-100 hover:border-zinc-300 transition-all duration-200 shadow-sm hover:shadow-md">
                <img
                  src={variation.src}
                  alt={variation.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
                  
                  {/* Pinterest-style overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="text-white text-xs font-medium line-clamp-1">{variation.title}</div>
                      <div className="text-white/90 text-xs mt-1 font-semibold">¥{variation.price?.toLocaleString()}</div>
                    </div>
                    
                    {/* Pinterest-style actions */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Midjourney-style variation number */}
                  <div className="absolute top-2 left-2 w-6 h-6 bg-black/90 text-white rounded-md flex items-center justify-center text-xs font-bold backdrop-blur-sm">
                    {index + 1}
                  </div>
                </div>
                
                {/* Variation label with Pinterest styling */}
                <div className="mt-3 text-center">
                  <div className="text-sm text-zinc-800 font-medium line-clamp-1">
                    {variation.variation || `Variation ${index + 1}`}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {variation.creator}
                  </div>
                </div>
                
                {/* Action buttons - V for variations only (U auto-done) */}
                <div className="mt-3 flex gap-2 justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVariation?.(variation, index);
                    }}
                    className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors font-medium flex items-center gap-1"
                    title="Generate variations (Coming Soon)"
                    disabled={true}  // Temporarily disabled until API supports it
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    V{index + 1}
                  </button>
                  {/* Future 2x/4x upscale button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement when API supports 2x/4x upscale
                    }}
                    className="px-3 py-1 text-xs bg-gray-400 text-white rounded cursor-not-allowed font-medium flex items-center gap-1"
                    title="High-res upscale (Coming Soon)"
                    disabled={true}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    2x
                  </button>
                </div>
              </div>
          ))}
        </div>
        
        {/* Enhanced action bar with gradient background */}
        <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-t border-zinc-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button className="px-4 py-2 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-200 font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </button>
              <button className="px-4 py-2 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-200 font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Upscale All
              </button>
            </div>
            <div className="text-sm text-zinc-600 font-medium">
              Click any variation to view details
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}