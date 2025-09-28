'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { GenerationModeSelector } from '../../components/GenerationModeSelector';
import { GenerationResultCards } from '../../components/GenerationResultCards';
import { EnhancedGenerationProgress } from '../../components/EnhancedGenerationProgress';
import { useGenerationSSE } from '../../hooks/useGenerationSSE';
import { buildGenerationPrompt, GenerationMode, ModeOptions } from '../../lib/promptBuilder';
import { Icons } from '../../components/Icons';
import { Asset } from '../../lib/types';
import { ImageDetailModal } from '../../components/ImageDetailModal';

interface CreatorProps {
  onGenerate: (assets: Asset[], openModal: boolean) => void;
}

export const Creator: React.FC<CreatorProps> = ({ onGenerate }) => {
  const { user } = useAuth();
  
  // Generation state
  const [mode, setMode] = useState<GenerationMode>('simple');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerationStep, setCurrentGenerationStep] = useState('');
  const [fallbackTimeoutId, setFallbackTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  // Mode-specific settings
  const [heritageSettings, setHeritageSettings] = useState({ code: 'comme', ratio: 0.5 });
  const [zeroSettings, setZeroSettings] = useState({ code: 'comme', ratio: 0.5 });
  const [mutationSettings, setMutationSettings] = useState<{ constraints: string[]; materials: string[] }>({ 
    constraints: [], 
    materials: [] 
  });
  
  // Generation history
  const [generationHistory, setGenerationHistory] = useState<{
    mode: GenerationMode;
    prompt: string;
    timestamp: Date;
    assets?: Asset[];
  }[]>([]);
  
  // Modal state
  const [selectedAsset, setSelectedAsset] = useState<{
    id: string;
    r2_url: string;
    width?: number;
    height?: number;
    imagine_image_index: number;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // SSE hook for real-time updates
  const { status: generationStatus, isConnected, error: sseError } = useGenerationSSE(currentJobId);

  // Load user's past generations on mount
  useEffect(() => {
    if (user) {
      loadPastGenerations();
    }
  }, [user]);

  const loadPastGenerations = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/my-generations?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        
        // Convert database generations to Asset format and group by job_id
        const groupedGenerations: Record<string, Asset[]> = {};
        
        data.generations.forEach((gen: any) => {
          const asset: Asset = {
            id: gen.id.toString(),
            src: gen.r2_url,
            title: gen.title || `${gen.mode} Generation`,
            tags: [gen.mode || 'generated'],
            colors: [],
            price: 0,
            creator: user.email || 'You',
            likes: 0,
            type: 'generated',
            isPublic: gen.is_public,
            w: gen.width || 1024,
            h: gen.height || 1024,
            variation: `Variation ${gen.imagine_image_index}`
          };
          
          if (!groupedGenerations[gen.job_id]) {
            groupedGenerations[gen.job_id] = [];
          }
          groupedGenerations[gen.job_id].push(asset);
        });
        
        // Convert to generation history format
        const historyEntries = Object.entries(groupedGenerations).map(([jobId, assets]) => {
          const firstAsset = data.generations.find((g: any) => g.job_id === jobId);
          return {
            mode: (firstAsset?.mode || 'simple') as GenerationMode,
            prompt: firstAsset?.prompt || '',
            timestamp: new Date(firstAsset?.created_at || Date.now()),
            assets
          };
        });
        
        setGenerationHistory(historyEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10));
        
        console.log('[Creator] Loaded past generations:', historyEntries.length);
      }
    } catch (error) {
      console.error('[Creator] Failed to load past generations:', error);
    }
  };
  
  // Handle SSE generation status updates
  useEffect(() => {
    if (!generationStatus || !currentJobId) return;

    console.log('[Creator] SSE Status update:', generationStatus);

    switch (generationStatus.status) {
      case 'processing':
        setGenerationProgress(generationStatus.progress);
        setCurrentGenerationStep('processing');
        break;

      case 'completed':
        if (generationStatus.assets && generationStatus.assets.length > 0) {
          // Convert webhook assets to our Asset format
          const generatedAssets: Asset[] = generationStatus.assets.map((asset, index) => ({
            id: asset.id,
            src: asset.r2_url,
            title: `${mode} Generation - ${index + 1}`,
            tags: [mode],
            colors: [],
            price: Math.floor(Math.random() * 10000) + 8000,
            creator: user?.email || 'Anonymous',
            likes: 0,
            type: 'generated' as const,
            isPublic: false,
            w: asset.width || 800,
            h: asset.height || 1200,
            variation: `Variation ${asset.imagine_image_index || index + 1}`
          }));

          // Add to history
          setGenerationHistory(prev => [{
            mode,
            prompt,
            timestamp: new Date(),
            assets: generatedAssets
          }, ...prev].slice(0, 10)); // Keep last 10

          onGenerate(generatedAssets, false);
        }
        
        setIsGenerating(false);
        setCurrentJobId(null);
        setCurrentImageId(null);
        setGenerationProgress(0);
        setCurrentGenerationStep('');
        
        // Clear fallback timeout since SSE completed successfully
        if (fallbackTimeoutId) {
          clearTimeout(fallbackTimeoutId);
          setFallbackTimeoutId(null);
        }
        break;

      case 'failed':
        console.error('[Creator] Generation failed:', generationStatus.error);
        setIsGenerating(false);
        setCurrentJobId(null);
        setCurrentImageId(null);
        setGenerationProgress(0);
        setCurrentGenerationStep('');
        
        // Clear fallback timeout on failure
        if (fallbackTimeoutId) {
          clearTimeout(fallbackTimeoutId);
          setFallbackTimeoutId(null);
        }
        break;
    }
  }, [generationStatus, currentJobId, mode, prompt, user, onGenerate]);

  const handleGenerate = async () => {
    if (!prompt && mode === 'simple') {
      alert('プロンプトを入力してください');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setCurrentGenerationStep('preparing');

    try {
      // Build mode-specific options
      const modeOptions: ModeOptions = {
        mode,
        basePrompt: prompt,
      };

      if (mode === 'heritage') {
        modeOptions.heritage = heritageSettings;
      } else if (mode === 'zero') {
        modeOptions.subtractor = zeroSettings;
      } else if (mode === 'mutation') {
        modeOptions.constraints = mutationSettings.constraints;
        modeOptions.materials = mutationSettings.materials;
      }

      // Build the complete prompt
      const fullPrompt = buildGenerationPrompt(modeOptions);
      
      console.log('[Creator] Generating with mode:', mode);
      console.log('[Creator] Full prompt:', fullPrompt);

      // Call the generate API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          mode,
          heritage: mode === 'heritage' ? heritageSettings : undefined,
          subtractor: mode === 'zero' ? zeroSettings : undefined,
          constraints: mode === 'mutation' ? mutationSettings.constraints : undefined,
          materials: mode === 'mutation' ? mutationSettings.materials : undefined,
          aspect_ratio: '2:3',
          user_id: user?.id,
          source: 'creator',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[Creator] Generate API result:', result);

      if (result.success && result.job_id) {
        // Set the job ID to start SSE monitoring
        setCurrentJobId(result.job_id);
        setCurrentImageId(result.image_id); // Store image_id for fallback polling
        setCurrentGenerationStep('queued');
        console.log('[Creator] Starting SSE monitoring for job:', result.job_id);
        
        // Start fallback polling after 30 seconds if SSE doesn't respond
        const timeoutId = setTimeout(() => {
          console.log('[Creator] SSE timeout - starting fallback polling');
          if (result.image_id && result.job_id) {
            startFallbackPolling(result.image_id, result.job_id);
          }
        }, 30000);
        
        setFallbackTimeoutId(timeoutId);
      } else {
        throw new Error('Invalid response from generate API');
      }
    } catch (error) {
      console.error('[Creator] Generation error:', error);
      setIsGenerating(false);
      setCurrentJobId(null);
      setGenerationProgress(0);
      setCurrentGenerationStep('');
      alert(`生成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getModeIcon = (m: GenerationMode) => {
    switch (m) {
      case 'simple': return <Icons.Message className="w-4 h-4" />;
      case 'heritage': return <Icons.Home className="w-4 h-4" />;
      case 'zero': return <Icons.AlertCircle className="w-4 h-4" />;
      case 'mutation': return <Icons.Sparkles className="w-4 h-4" />;
      default: return null;
    }
  };

  const getModeColor = (m: GenerationMode) => {
    switch (m) {
      case 'simple': return 'bg-gray-100 text-gray-700';
      case 'heritage': return 'bg-orange-100 text-orange-700';
      case 'zero': return 'bg-purple-100 text-purple-700';
      case 'mutation': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleModalClose = () => {
    setSelectedAsset(null);
    setIsModalOpen(false);
  };

  // Fallback: Direct polling if SSE is too slow
  const startFallbackPolling = (imageId: string, jobId: string) => {
    console.log('[Creator] Starting fallback polling for:', imageId);
    
    const pollDirectly = async () => {
      try {
        const response = await fetch(`/api/imagine-status?imageId=${imageId}&jobId=${jobId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[Creator] Fallback polling result:', data.status);
          
          if (data.status === 'completed' && data.upscaled_urls && data.upscaled_urls.length > 0) {
            console.log('[Creator] Fallback polling found completion!');
            
            // Convert to assets and show results
            const generatedAssets: Asset[] = data.upscaled_urls.map((url: string, index: number) => ({
              id: `${data.id}_${index + 1}`,
              src: url,
              title: `${mode} Generation - ${index + 1}`,
              tags: [mode],
              colors: [],
              price: Math.floor(Math.random() * 10000) + 8000,
              creator: user?.email || 'Anonymous',
              likes: 0,
              type: 'generated' as const,
              isPublic: false,
              w: 1024,
              h: 1024,
              variation: `Variation ${index + 1}`
            }));

            // Add to history
            setGenerationHistory(prev => [{
              mode,
              prompt,
              timestamp: new Date(),
              assets: generatedAssets
            }, ...prev].slice(0, 10));

            onGenerate(generatedAssets, false);
            
            setIsGenerating(false);
            setCurrentJobId(null);
            setCurrentImageId(null);
            setGenerationProgress(0);
            setCurrentGenerationStep('');
            
            return true; // Stop polling
          }
        }
      } catch (error) {
        console.error('[Creator] Fallback polling error:', error);
      }
      return false; // Continue polling
    };

    // Poll every 2 seconds for up to 2 minutes
    let attempts = 0;
    const maxAttempts = 60;
    
    const intervalId = setInterval(async () => {
      attempts++;
      const completed = await pollDirectly();
      
      if (completed || attempts >= maxAttempts) {
        clearInterval(intervalId);
        if (attempts >= maxAttempts) {
          console.log('[Creator] Fallback polling timed out');
          setIsGenerating(false);
          setCurrentJobId(null);
          setCurrentImageId(null);
        }
      }
    }, 2000);
  };

  return (
    <div className="creator-container max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Mode Selection and Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Advanced Creator
            </h2>
            <p className="text-gray-600">
              Heritage、ZERO、Mutationモードで新しいファッションを創造
            </p>
          </div>

          {/* Mode Selector */}
          <GenerationModeSelector
            mode={mode}
            onModeChange={setMode}
            heritageSettings={heritageSettings}
            onHeritageChange={setHeritageSettings}
            zeroSettings={zeroSettings}
            onZeroChange={setZeroSettings}
            mutationSettings={mutationSettings}
            onMutationChange={setMutationSettings}
          />

          {/* Prompt Input */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ベースプロンプト {mode !== 'simple' && '（オプション）'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'simple' 
                  ? "デザインの詳細を入力..." 
                  : "追加の詳細（オプション）..."
              }
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] resize-none"
              rows={3}
              disabled={isGenerating}
            />
            
            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (mode === 'simple' && !prompt)}
              className={`mt-4 w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                isGenerating || (mode === 'simple' && !prompt)
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#FF7A1A] to-[#FF9A4A] text-white hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center">
                  <Icons.RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Icons.Sparkles className="w-4 h-4 mr-2" />
                  生成開始
                </span>
              )}
            </button>
          </div>

          {/* Generation Progress */}
          {isGenerating && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <EnhancedGenerationProgress
                isGenerating={isGenerating}
                currentStep={currentGenerationStep}
                progress={generationProgress}
              />
              {sseError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {sseError}
                </div>
              )}
            </div>
          )}

          {/* Latest Results */}
          {generationHistory.length > 0 && generationHistory[0].assets && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">最新の生成結果</h3>
              <GenerationResultCards
                jobId={currentJobId || ''}
                assets={generationHistory[0].assets.map(a => ({
                  id: a.id,
                  r2_url: a.src,
                  width: a.w,
                  height: a.h,
                  imagine_image_index: parseInt(a.variation?.replace('Variation ', '') || '1')
                }))}
                onCardClick={(asset) => {
                  setSelectedAsset(asset);
                  setIsModalOpen(true);
                }}
              />
            </div>
          )}
        </div>

        {/* Right Panel: History and Stats */}
        <div className="space-y-6">
          {/* Generation Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">統計</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">総生成数</span>
                <span className="font-medium">{generationHistory.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">最多モード</span>
                <span className="font-medium">
                  {generationHistory.length > 0 
                    ? (() => {
                        const counts = generationHistory.reduce((acc, h) => {
                          acc[h.mode] = (acc[h.mode] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
                      })()
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">SSE接続</span>
                <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
                  {isConnected ? '接続中' : '待機中'}
                </span>
              </div>
            </div>
          </div>

          {/* Generation History */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">生成履歴</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {generationHistory.length === 0 ? (
                <p className="text-sm text-gray-500">まだ生成履歴がありません</p>
              ) : (
                generationHistory.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`flex items-center space-x-2 px-2 py-1 rounded-md text-xs ${getModeColor(item.mode)}`}>
                        {getModeIcon(item.mode)}
                        <span className="font-medium">{item.mode.toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {item.prompt && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {item.prompt}
                      </p>
                    )}
                    {item.assets && (
                      <div className="mt-2 flex space-x-1">
                        {item.assets.slice(0, 4).map((asset, i) => (
                          <div key={i} className="w-8 h-10 bg-gray-200 rounded overflow-hidden">
                            <img 
                              src={asset.src} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
            <h3 className="text-lg font-semibold mb-3 text-purple-900">
              <Icons.AlertCircle className="inline w-5 h-5 mr-2" />
              Tips
            </h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li>• <strong>Heritage:</strong> 名作スタイルを参照して発展</li>
              <li>• <strong>ZERO:</strong> 既知のパターンから意図的に離脱</li>
              <li>• <strong>Mutation:</strong> 制約と素材で創発的デザイン</li>
              <li>• 生成後にNovelty Indexが自動計算されます</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Detail Modal */}
      <ImageDetailModal
        asset={selectedAsset}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        jobId={currentJobId}
      />
    </div>
  );
};

export default Creator;