import { Asset } from '../lib/types';
import { Icons } from './Icons';
import { useAuth } from '../lib/AuthContext';
import { useState } from 'react';

interface UserGalleryModalProps {
  asset: Asset;
  onClose: () => void;
  onDelete?: (assetId: string) => void;
  onPublish?: (asset: Asset) => void;
  onEditTags?: (asset: Asset, newTags: string[]) => void;
  canEdit?: boolean;
}

export function UserGalleryModal({ 
  asset, 
  onClose, 
  onDelete, 
  onPublish, 
  onEditTags,
  canEdit = true 
}: UserGalleryModalProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [newTags, setNewTags] = useState(asset.tags || []);
  const [tagInput, setTagInput] = useState('');

  const handleDelete = async () => {
    if (!user || !onDelete) return;
    
    const confirmed = window.confirm('この画像を削除しますか？この操作は取り消せません。');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/my-generations?user_id=${user.id}&id=${asset.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      
      onDelete(asset.id);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !newTags.includes(tag) && newTags.length < 10) {
      setNewTags([...newTags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewTags(newTags.filter(tag => tag !== tagToRemove));
  };

  const handleSaveTags = () => {
    if (onEditTags) {
      onEditTags(asset, newTags);
    }
    setEditingTags(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  const isPublished = (asset as any).is_published || false;
  const generationParams = (asset as any).generation_params || {};
  const originalPrompt = (asset as any).original_prompt;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden grid md:grid-cols-2" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Section */}
        <div className="relative p-4 md:p-6 grid place-items-center bg-gray-50">
          <img 
            src={asset.src} 
            alt={asset.title}
            className="max-h-[60vh] md:max-h-[75vh] w-auto object-contain rounded-xl" 
          />
          {isPublished && (
            <div className="absolute top-6 right-6">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                <Icons.Sparkles size={12} className="mr-1" />
                出品中
              </span>
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="p-4 md:p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{asset.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Icons.User size={14} />
                <span>あなたの作品</span>
                <span>•</span>
                <span>{new Date((asset as any).created_at || Date.now()).toLocaleDateString('ja-JP')}</span>
              </div>
            </div>
            <button onClick={onClose} className="iconbtn">
              <Icons.ArrowLeft />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-600">
                  <Icons.Heart size={14} />
                  <span className="text-sm">{asset.likes || 0}</span>
                </div>
                <span className="text-xs text-gray-500">いいね</span>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">{(asset as any).views || 0}</div>
                <span className="text-xs text-gray-500">表示数</span>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">{(asset as any).width || 1024}×{(asset as any).height || 1536}</div>
                <span className="text-xs text-gray-500">サイズ</span>
              </div>
            </div>

            {/* Original Prompt */}
            {originalPrompt && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Icons.Message size={16} />
                  生成プロンプト
                </h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 leading-relaxed">{originalPrompt}</p>
                </div>
              </div>
            )}

            {/* Generation Parameters */}
            {generationParams && Object.keys(generationParams).length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Icons.Settings size={16} />
                  生成パラメータ
                </h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {generationParams.vibe && (
                    <div className="text-sm mb-1">
                      <span className="font-medium">雰囲気:</span> {generationParams.vibe}
                    </div>
                  )}
                  {generationParams.silhouette && (
                    <div className="text-sm mb-1">
                      <span className="font-medium">シルエット:</span> {generationParams.silhouette}
                    </div>
                  )}
                  {generationParams.palette && (
                    <div className="text-sm">
                      <span className="font-medium">カラー:</span> {generationParams.palette}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Icons.Star size={16} />
                  タグ
                </h4>
                {canEdit && (
                  <button 
                    onClick={() => setEditingTags(!editingTags)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {editingTags ? 'キャンセル' : '編集'}
                  </button>
                )}
              </div>
              
              {editingTags ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="新しいタグを入力"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                      maxLength={20}
                    />
                    <button 
                      onClick={handleAddTag}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg"
                    >
                      追加
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {tag}
                        <button 
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveTags}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg"
                    >
                      保存
                    </button>
                    <button 
                      onClick={() => {
                        setNewTags(asset.tags || []);
                        setEditingTags(false);
                      }}
                      className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded-lg"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(asset.tags || []).map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {(!asset.tags || asset.tags.length === 0) && (
                    <span className="text-sm text-gray-500">タグなし</span>
                  )}
                </div>
              )}
            </div>

            {/* Colors */}
            {asset.colors && asset.colors.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">カラー</h4>
                <div className="flex gap-2">
                  {asset.colors.map((color) => (
                    <span key={color} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t space-y-3">
            {!isPublished && onPublish && (
              <button 
                onClick={() => onPublish(asset)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Icons.Sparkles size={18} />
                マーケットプレイスに出品
              </button>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = asset.src;
                  link.download = `${asset.title}.jpg`;
                  link.click();
                }}
                className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Icons.Bookmark size={16} />
                ダウンロード
              </button>
              
              {canEdit && !isPublished && onDelete && (
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="py-2 px-4 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Icons.Plus size={16} className="rotate-45" />
                  {isDeleting ? '削除中...' : '削除'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}