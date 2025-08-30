import { useState, useEffect } from 'react';
import { Asset } from '../lib/types';
import { useAuth } from '../lib/AuthContext';
import { Icons } from './Icons';
import { OptimizedPinCard } from './OptimizedPinCard';
import { UserGalleryModal } from './UserGalleryModal';
import { PublishForm } from '../pages/publish/PublishForm';

type GalleryType = 'all' | 'generated' | 'published' | 'saved';

interface UserGalleryProps {
  onPublishToGallery?: (asset: Asset) => void;
}

export function UserGallery({ onPublishToGallery: _onPublishToGallery }: UserGalleryProps) {
  const { user } = useAuth();
  const [activeType, setActiveType] = useState<GalleryType>('all');
  const [images, setImages] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [publishingAsset, setPublishingAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadImages();
    }
  }, [user, activeType]);

  const loadImages = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user-gallery?user_id=${user.id}&type=${activeType}&limit=100`);
      if (!response.ok) throw new Error('Failed to load gallery');
      
      const data = await response.json();
      
      // Transform the data to match Asset interface
      const transformedImages: Asset[] = data.images.map((img: any) => ({
        id: img.id,
        src: img.r2_url,
        title: img.title,
        tags: img.tags || [],
        colors: img.colors || [],
        likes: img.likes || 0,
        creator: user.user_metadata?.name || 'あなた',
        price: img.published_items?.[0]?.price,
        created_at: img.created_at,
        type: img.type || 'generated',
        width: img.width,
        height: img.height,
        // Additional metadata
        original_prompt: img.original_prompt,
        generation_params: img.generation_params,
        is_published: img.is_published,
        published_items: img.published_items
      }));

      setImages(transformedImages);
    } catch (err) {
      console.error('Error loading gallery:', err);
      setError('ギャラリーの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = (assetId: string) => {
    setImages(prev => prev.filter(img => img.id !== assetId));
  };

  const handlePublish = (asset: Asset) => {
    setSelectedAsset(null);
    setPublishingAsset(asset);
  };

  const handlePublishComplete = () => {
    setPublishingAsset(null);
    // Refresh the gallery to show updated status
    loadImages();
  };

  const handleEditTags = async (asset: Asset, newTags: string[]) => {
    // TODO: Implement tag editing API
    console.log('Edit tags:', asset.id, newTags);
  };

  const tabs = [
    { id: 'all', label: 'すべて', icon: Icons.Gallery },
    { id: 'generated', label: '生成画像', icon: Icons.Sparkles },
    { id: 'published', label: '出品中', icon: Icons.Trending },
    { id: 'saved', label: '保存済み', icon: Icons.Bookmark }
  ] as const;

  const getEmptyStateMessage = (type: GalleryType) => {
    switch (type) {
      case 'generated':
        return 'まだAIで画像を生成していません。「作成」タブから始めましょう！';
      case 'published':
        return 'まだ作品を出品していません。生成した画像から出品してみましょう。';
      case 'saved':
        return 'まだ画像を保存していません。気に入った作品を保存しましょう。';
      default:
        return 'まだ画像がありません。AIで画像を生成するか、気に入った作品を保存してみましょう。';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Icons.User size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-4">マイギャラリーを見るにはログインが必要です</p>
          <button className="btn bg-accent text-white border-accent">
            ログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">マイギャラリー</h1>
            <p className="text-gray-600 mt-1">あなたの作品を管理しましょう</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{images.length}</div>
            <div className="text-sm text-gray-500">作品</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="py-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveType(tab.id as GalleryType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeType === tab.id
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            <p className="mt-4 text-gray-500">読み込み中...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Icons.AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={loadImages}
              className="btn bg-accent text-white border-accent"
            >
              再試行
            </button>
          </div>
        </div>
      ) : images.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <Icons.Image size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-6">{getEmptyStateMessage(activeType)}</p>
            {activeType === 'generated' && (
              <button 
                onClick={() => {/* Navigate to create tab */}}
                className="btn bg-accent text-white border-accent"
              >
                画像を生成する
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pb-10">
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-3 lg:gap-4 [column-fill:_balance]">
            {images.map((asset, index) => {
              const columnsCount = typeof window !== 'undefined' 
                ? (window.innerWidth >= 1536 ? 7 : window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 4 : window.innerWidth >= 640 ? 3 : 2)
                : 5;
              const isFirstRow = index < columnsCount;
              
              return (
                <div key={asset.id} className="mb-4 break-inside-avoid">
                  <OptimizedPinCard 
                    asset={asset} 
                    onOpen={() => setSelectedAsset(asset)} 
                    onLike={() => {/* Handle like */}}
                    isFirstRow={isFirstRow}
                    showOwnerActions={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAsset && (
        <UserGalleryModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onDelete={handleDeleteImage}
          onPublish={handlePublish}
          onEditTags={handleEditTags}
          canEdit={true}
        />
      )}

      {/* Publish Modal */}
      {publishingAsset && (
        <PublishForm
          asset={publishingAsset}
          onPublish={handlePublishComplete}
          onCancel={() => setPublishingAsset(null)}
        />
      )}
    </div>
  );
}