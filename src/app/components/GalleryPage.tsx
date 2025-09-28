import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Asset } from '../lib/types'
import './GalleryPage.css'

// ポスターテンプレートの定義
const posterTemplates = [
  { id: 1, bgColor: '#FF8C42', textColor: '#000', fontStyle: 'modern' },
  { id: 2, bgColor: '#C73E1D', textColor: '#FFE66D', fontStyle: 'retro' },
  { id: 3, bgColor: '#FFFFFF', textColor: '#000', fontStyle: 'minimal' },
  { id: 4, bgColor: '#4169E1', textColor: '#FFF', fontStyle: 'bold' },
  { id: 5, bgColor: '#FFF', textColor: '#FF1744', fontStyle: 'editorial' },
  { id: 6, bgColor: '#FFE4B5', textColor: '#8B4513', fontStyle: 'vintage' },
  { id: 7, bgColor: '#4169E1', textColor: '#FFD700', fontStyle: 'sport' },
  { id: 8, bgColor: '#FF6347', textColor: '#000', fontStyle: 'street' },
]

export function GalleryPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    try {
      // まずカタログAPIからデータを取得
      const catalogResponse = await fetch('/api/catalog')
      if (catalogResponse.ok) {
        const catalogData = await catalogResponse.json()
        if (catalogData.images && catalogData.images.length > 0) {
          // カタログ画像をAsset形式に変換
          const catalogAssets = catalogData.images.map((img: any) => ({
            id: img.id,
            src: img.src,
            title: img.title || 'Fashion Design',
            tags: img.tags || [],
            colors: [],
            price: Math.floor(Math.random() * 30000) + 10000, // ランダム価格
            creator: 'OWM Catalog',
            likes: Math.floor(Math.random() * 100),
            w: 400,
            h: 600,
            type: 'catalog'
          }))
          setAssets(catalogAssets.slice(0, 16)) // 最初の16件を表示
          setLoading(false)
          return
        }
      }

      // カタログが取得できない場合はpublished_itemsから取得
      const { data, error } = await supabase
        .from('published_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(16)

      if (error) throw error
      setAssets(data || [])
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPosterImage = (asset: Asset, template: any) => {
    // ポスターテンプレートに画像を配置する処理
    // 実際の実装ではCanvasを使用して画像を生成
    return {
      ...asset,
      posterStyle: template,
    }
  }

  return (
    <div className="gallery-container">
      {/* Top white line */}
      <div className="top-line"></div>

      <div className="gallery-grid">
        {assets.map((asset, index) => {
          const template = posterTemplates[index % posterTemplates.length]
          return (
            <div key={asset.id} className="poster-item" style={{ backgroundColor: template.bgColor }}>
              <div className="poster-header">
                <span className="poster-brand" style={{ color: template.textColor }}>
                  {index % 2 === 0 ? 'VERY PORTLAND' : 'form'}
                </span>
                <span className="poster-number" style={{ color: template.textColor }}>
                  265
                </span>
              </div>
              <div className="poster-image">
                <img src={asset.src} alt={asset.title} />
              </div>
              <div className="poster-footer">
                <div className="poster-title" style={{ color: template.textColor }}>
                  {asset.title || 'Untitled'}
                </div>
                <div className="poster-meta" style={{ color: template.textColor }}>
                  <span>{asset.creator || 'Anonymous'}</span>
                  <span>{new Date(asset.createdAt || '').toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom white line */}
      <div className="bottom-line"></div>
    </div>
  )
}