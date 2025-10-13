import { useState, useRef, useEffect } from 'react';
import { Asset } from '../../lib/types';
import { useAuth } from '../../lib/AuthContext';
import { AssistantQuickFlow } from '../../components/AssistantQuickFlow';
import { ResultsBlock } from '../../components/ResultsBlock';
import { Composer } from '../../components/Composer';
import { Icons } from '../../components/Icons';
import { buildGeneratePayload } from '../../lib/prompt/build';
import type { ChatSelections } from '../../lib/prompt/types';
import { EnhancedGenerationProgress } from '../../components/EnhancedGenerationProgress';
import { GenerationResultCards } from '../../components/GenerationResultCards';
import { useGenerationSSE } from '../../hooks/useGenerationSSE';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  options?: string[];
  imagePreview?: string;
  isQuickFlow?: boolean;
  results?: Asset[];
}

interface DesignParams {
  vibe?: string;
  silhouette?: string;
  palette?: string;
  personalStyle?: string;
  occasion?: string;
  referenceImage?: File;
}

interface ChatDesignerProps {
  onGenerate: (images: Asset[], isPublic: boolean) => void;
  onSelectVariation?: (asset: Asset) => void;
}

export function ChatDesigner({ onGenerate }: ChatDesignerProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [designParams, setDesignParams] = useState<DesignParams>({});
  const [step, setStep] = useState(0);
  const [finalPrompt, setFinalPrompt] = useState<string>('');
  const [showQuickFlow, setShowQuickFlow] = useState(false);
  const [currentGenerationStep, setCurrentGenerationStep] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use the new SSE hook for generation updates
  const { status: generationStatus, isConnected, error: sseError } = useGenerationSSE(currentJobId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle SSE generation status updates
  useEffect(() => {
    if (!generationStatus || !currentJobId) return;

    console.log('[ChatDesigner] SSE Status update:', generationStatus);

    switch (generationStatus.status) {
      case 'processing':
        setGenerationProgress(generationStatus.progress);
        setCurrentGenerationStep('processing');
        
        // Update generating message with progress
        setMessages(prev => prev.map(msg => 
          msg.content.includes('デザインを生成中です') && msg.role === 'assistant'
            ? { ...msg, content: `🎨 デザインを生成中です...${generationStatus.progress}%` }
            : msg
        ));
        break;

      case 'completed':
        if (generationStatus.assets && generationStatus.assets.length > 0) {
          // Convert webhook assets to our Asset format
          const generatedAssets: Asset[] = generationStatus.assets.map((asset, index) => ({
            id: asset.id,
            src: asset.r2_url,
            title: `${designParams.vibe || 'カスタム'} ${designParams.silhouette || 'スタイル'} - ${index + 1}`,
            tags: [designParams.vibe, designParams.silhouette, designParams.occasion].filter(Boolean) as string[],
            colors: [designParams.palette].filter(Boolean) as string[],
            price: Math.floor(Math.random() * 10000) + 8000,
            creator: 'You',
            likes: 0,
            type: 'generated' as const,
            isPublic: false,
            w: asset.width || 800,
            h: asset.height || 1200,
            variation: `Variation ${asset.imagine_image_index || index + 1}`
          }));

          const completedMessage: Message = {
            id: `completed-${Date.now()}`,
            role: 'assistant',
            content: '✨ デザインが完成しました！お気に入りのデザインを選んでください。',
            timestamp: new Date()
          };
          
          const resultsMessage: Message = {
            id: `results-${Date.now()}`,
            role: 'assistant', 
            content: '4つのバリエーションが生成されました。',
            timestamp: new Date(),
            results: generatedAssets
          };

          setMessages(prev => {
            // Remove generating message and add completion messages
            const filtered = prev.filter(msg => !msg.content.includes('デザインを生成中です'));
            return [...filtered, completedMessage, resultsMessage];
          });

          onGenerate(generatedAssets, false);
        }
        
        setIsGenerating(false);
        setCurrentJobId(null);
        setGenerationProgress(0);
        setCurrentGenerationStep('');
        break;

      case 'failed':
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ 生成に失敗しました: ${generationStatus.error || '不明なエラー'}`,
          timestamp: new Date()
        };

        setMessages(prev => {
          const filtered = prev.filter(msg => !msg.content.includes('デザインを生成中です'));
          return [...filtered, errorMessage];
        });

        setIsGenerating(false);
        setCurrentJobId(null);
        setGenerationProgress(0);
        setCurrentGenerationStep('');
        break;
    }
  }, [generationStatus, currentJobId, designParams, onGenerate]);

  useEffect(() => {
    // 初回メッセージ - 新しいクイックフロー
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: 'こんにちは！✨ あなただけのファッションデザインを一緒に作りましょう！',
      timestamp: new Date(),
      isQuickFlow: true
    };
    setMessages([welcomeMessage]);
    setShowQuickFlow(true);
  }, []);

  const handleStepChange = (step: number, answers: any) => {
    // 選択に対する会話的な反応
    const reactions = [
      [`${answers.vibe}スタイル、いいですね！`, `${answers.vibe}な雰囲気でいきましょう✨`],
      [`${answers.fit}のシルエットですね！`, `${answers.fit}がお似合いになりそうです👌`],
      [`${answers.palette}で仕上げますね！`, `${answers.palette}のパレットで素敵に🎨`]
    ];

    if (reactions[step] && answers[step === 0 ? 'vibe' : step === 1 ? 'fit' : 'palette']) {
      const reactionMessage: Message = {
        id: `reaction-${Date.now()}`,
        role: 'assistant',
        content: reactions[step][Math.floor(Math.random() * reactions[step].length)],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, reactionMessage]);
    }
  };

  const handleQuickFlowComplete = async (answers: any, customPrompt?: string) => {
    // DeepSeek用の選択情報を構築
    const selections: ChatSelections = {
      vibe: answers.vibe,
      silhouette: answers.fit,
      palette: answers.palette,
      aspectRatio: '2:3',  // ファッション向けの縦長
      quality: 'high',
      creativity: 'balanced',
      customRequest: customPrompt // カスタムプロンプトを追加
    };
    
    setDesignParams({
      vibe: answers.vibe,
      silhouette: answers.fit,
      palette: answers.palette
    });
    setShowQuickFlow(false);
    
    // プロンプト生成開始メッセージ
    const promptMessage: Message = {
      id: `prompt-${Date.now()}`,
      role: 'assistant',
      content: '🤖 AIがあなたの理想のデザインプロンプトを作成しています...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, promptMessage]);
    
    try {
      // DeepSeekでプロンプトを生成
      setCurrentGenerationStep('prompt');
      const payload = await buildGeneratePayload(selections);
      
      // プロンプト完成メッセージ
      const promptDoneMessage: Message = {
        id: `prompt-done-${Date.now()}`,
        role: 'assistant',
        content: '✨ プロンプトが完成しました！生成を開始します',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, promptDoneMessage]);
      
      // Midjourney形式のプロンプトを構築
      const fullPrompt = `${payload.prompt} ${payload.params.mj} --no ${payload.negative_prompt}`;
      
      console.log('[ChatDesigner] DeepSeek generated prompt:', {
        selections,
        payload,
        fullPrompt
      });
      
      setCurrentGenerationStep('generate');
      handleGenerate(fullPrompt);
    } catch (error) {
      console.error('[ChatDesigner] Failed to generate with DeepSeek:', error);
      
      // フォールバック: シンプルなプロンプト生成
      const fallbackPrompt = `single model, full-body fashion photography, ${answers.vibe} style, ${answers.fit} fit, ${answers.palette} colors, professional studio lighting, clean minimal background --ar 2:3 --style raw --no text, logos, multiple people, brands`;
      handleGenerate(fallbackPrompt);
    }
  };

  const handleSendMessage = async (content: string, isOption: boolean = false) => {
    if (!content.trim() && !isOption) return;

    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user', 
      content: content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // クイックフロー中の場合、直接生成に進む
    if (showQuickFlow) {
      setShowQuickFlow(false);
      
      // テキスト入力から基本パラメータを推測
      const quickAnswers = {
        vibe: 'カスタム',
        fit: 'フリー', 
        palette: 'ニュートラル'
      };
      
      handleQuickFlowComplete(quickAnswers, content);
      return;
    }

    setIsTyping(true);

    try {
      // チャットAPIに送信
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          designParams,
          step,
          user_id: user?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        // パラメータ更新
        setDesignParams(prev => ({ ...prev, ...result.updatedParams }));
        setStep(result.nextStep);

        // AIレスポンスメッセージ
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          options: result.options
        };

        setMessages(prev => [...prev, aiMessage]);

        // 生成準備完了の場合
        if (result.readyToGenerate) {
          setFinalPrompt(result.finalPrompt);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileAttach = (file: File) => {
    setDesignParams(prev => ({ ...prev, referenceImage: file }));
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageMessage: Message = {
        id: `image-${Date.now()}`,
        role: 'user',
        content: '参考画像をアップロードしました',
        timestamp: new Date(),
        imagePreview: e.target?.result as string
      };
      setMessages(prev => [...prev, imageMessage]);
      
      // 画像解析を開始
      handleSendMessage('画像を参考にしてください', true);
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerate = () => {
    if (finalPrompt) {
      handleGenerate(finalPrompt);
    }
  };

  const handlePublishSelected = (selectedIds: string[]) => {
    // Find the assets and trigger publish flow
    const allResults = messages.find(m => m.results)?.results || [];
    const selectedAssets = allResults.filter(asset => selectedIds.includes(asset.id));
    
    if (selectedAssets.length > 0) {
      // Trigger publish modal or flow
      console.log('Publishing assets:', selectedAssets);
      // This could trigger a publish modal or redirect to publish page
    }
  };

  const handleLike = (id: string) => {
    // Handle like functionality
    console.log('Liked asset:', id);
  };

  const handleSave = (id: string) => {
    // Handle save functionality  
    console.log('Saved asset:', id);
  };

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    
    const generatingMessage: Message = {
      id: `generating-${Date.now()}`,
      role: 'assistant',
      content: '🎨 デザインを生成中です...少しお待ちください',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, generatingMessage]);

    try {
      console.log('[ChatDesigner] Starting generation with prompt:', prompt);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspect_ratio: '2:3',
          user_id: user?.id,
          source: 'chat'
        })
      });

      console.log('[ChatDesigner] Generate API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChatDesigner] API Error:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[ChatDesigner] Generate API result:', result);

      // Handle new webhook-based response
      if (result.success && result.job_id) {
        // Set the job ID to start SSE monitoring
        setCurrentJobId(result.job_id);
        setCurrentGenerationStep('queued');
        
        console.log('[ChatDesigner] Starting SSE monitoring for job:', result.job_id);
      } else {
        throw new Error('Invalid response from generate API');
      }
    } catch (error) {
      console.error('[ChatDesigner] Generation error:', error);
      const errorMessage: Message = {
        id: `gen-error-${Date.now()}`,
        role: 'assistant',
        content: `❌ 生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const pollForCompletion = async (imageId: string, _sessionId: string) => {
    console.log('[ChatDesigner] Starting polling for imageId:', imageId);
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    
    const poll = async (): Promise<void> => {
      try {
        attempts++;
        console.log(`[ChatDesigner] Polling attempt ${attempts}/${maxAttempts}`);
        
        const response = await fetch(`/api/generate-status/${imageId}`);
        
        if (!response.ok) {
          console.error('[ChatDesigner] Polling API error:', response.status);
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
            return;
          }
          throw new Error(`Polling failed: ${response.status}`);
        }
        
        const statusData = await response.json();
        console.log('[ChatDesigner] Polling status:', statusData);
        
        switch (statusData.status) {
          case 'completed':
            if (statusData.images && statusData.images.length > 0) {
              // Process completed images (same logic as SSE)
              const generatedAssets: Asset[] = statusData.images.map((img: any, index: number) => ({
                id: img.id,
                src: img.url,
                title: `${designParams.vibe || 'カスタム'} ${designParams.silhouette || 'スタイル'} - ${index + 1}`,
                tags: [designParams.vibe, designParams.silhouette, designParams.occasion].filter(Boolean) as string[],
                colors: [designParams.palette].filter(Boolean) as string[],
                price: Math.floor(Math.random() * 10000) + 8000,
                creator: 'You',
                likes: 0,
                type: 'generated' as const,
                isPublic: false,
                w: 800,
                h: 1200,
                variation: `Variation ${index + 1}`
              }));

              const completedMessage: Message = {
                id: `completed-${Date.now()}`,
                role: 'assistant',
                content: '✨ デザインが完成しました！',
                timestamp: new Date()
              };
              setMessages(prev => [...prev, completedMessage]);

              const resultsMessage: Message = {
                id: `results-${Date.now()}`,
                role: 'assistant',
                content: '✨ デザインが完成しました！',
                timestamp: new Date(),
                results: generatedAssets
              };
              setMessages(prev => [...prev, resultsMessage]);

              onGenerate(generatedAssets, false);
            } else {
              throw new Error('No images received from polling');
            }
            break;
            
          case 'failed':
            throw new Error(statusData.error || 'Generation failed');
            
          case 'pending':
          case 'processing':
            // Update progress if available
            if (statusData.progress) {
              setGenerationProgress(statusData.progress);
              setCurrentGenerationStep(statusData.step || 'generate');
              setMessages(prev => prev.map(msg => 
                msg.id.startsWith('generating-') 
                  ? { ...msg, content: `🎨 デザインを生成中です...${statusData.progress}%` }
                  : msg
              ));
            }
            
            // Continue polling
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
            } else {
              throw new Error('Polling timeout - generation took too long');
            }
            break;
            
          default:
            console.warn('[ChatDesigner] Unknown status:', statusData.status);
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
            } else {
              throw new Error(`Unknown status: ${statusData.status}`);
            }
        }
      } catch (error) {
        console.error('[ChatDesigner] Polling error:', error);
        
        const errorMessage: Message = {
          id: `poll-error-${Date.now()}`,
          role: 'assistant',
          content: `❌ 生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        setIsGenerating(false);
      }
    };
    
    // Start polling
    setTimeout(poll, 2000); // Initial 2-second delay
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="border-b border-ink-200 px-4 py-3 flex items-center bg-white/95 backdrop-blur sticky top-0 z-10">
        <button 
          onClick={() => window.history.back()}
          className="iconbtn mr-2"
        >
          <Icons.ArrowLeft />
        </button>
        <h1 className="text-lg font-semibold text-ink-900">AI デザイナー</h1>
        <div className="ml-auto">
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
            <Icons.Palette className="text-white" size={16} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-accent text-white rounded-2xl px-4 py-3'
                  : 'card px-4 py-3'
              }`}
            >
              {message.imagePreview && (
                <img 
                  src={message.imagePreview} 
                  alt="Reference" 
                  className="w-full max-w-xs rounded-lg mb-2"
                />
              )}
              
              <p className="text-sm">{message.content}</p>
              
              {/* Quick Flow Component */}
              {message.isQuickFlow && showQuickFlow && (
                <div className="mt-3">
                  <AssistantQuickFlow 
                    onDone={handleQuickFlowComplete}
                    onStepChange={handleStepChange}
                  />
                  <div className="mt-3 pt-3 border-t border-ink-200">
                    <p className="text-xs text-ink-500 mb-2">または下のチャットで詳しく指定してください 💬</p>
                  </div>
                </div>
              )}
              
              {/* Results Display */}
              {message.results && (
                <div className="mt-4 -mx-4">
                  <ResultsBlock
                    items={message.results}
                    onPublish={handlePublishSelected}
                    onRegenerate={handleRegenerate}
                    onLike={handleLike}
                    onSave={handleSave}
                  />
                </div>
              )}
              
              {/* Option chips */}
              {message.options && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {message.options.map((option, index) => (
                    <button
                      key={index}
                      className="chip"
                      onClick={() => handleSendMessage(option, true)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Enhanced Generation Progress */}
        {isGenerating && (
          <div className="flex justify-center">
            <EnhancedGenerationProgress 
              isGenerating={isGenerating}
              currentStep={currentGenerationStep}
              progress={generationProgress}
            />
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="card px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-ink-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-ink-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-ink-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer - Show alongside quick flow and always after */}
      {!isGenerating && (
        <div className="border-t border-ink-200">
          <Composer
            onSend={handleSendMessage}
            onAttach={handleFileAttach}
            disabled={isTyping || isGenerating}
            placeholder={showQuickFlow ? "または詳細をチャットで指定..." : "追加のリクエストがあれば入力してください..."}
          />
        </div>
      )}

      {/* Quick action button after follow-up */}
      {!showQuickFlow && !isGenerating && messages.length > 1 && (
        <div className="sticky bottom-0 bg-white border-t border-ink-200 p-4">
          <button
            onClick={() => {
              // Generate with current design params
              const prompt = `A full-body shot of a single model wearing ${designParams.vibe || 'stylish'} ${designParams.silhouette || 'tailored'} outfit in ${designParams.palette || 'neutral'} colors, fashion photography, professional lighting, clean background --ar 2:3 --no multiple people, group photo, logo, text, brand, watermark --v 6 --style raw`;
              handleGenerate(prompt);
            }}
            className="w-full btn bg-accent text-white border-accent flex items-center justify-center gap-2"
          >
            <Icons.Sparkles size={18} />
            デザインを作成
          </button>
        </div>
      )}
    </div>
  );
}