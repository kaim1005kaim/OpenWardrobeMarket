import { useState, useEffect, useRef } from 'react'
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
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAssets()
  }, [])

  // マウスホイールで横スクロール
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!scrollContainerRef.current) return

      e.preventDefault()
      // deltaYが大きい場合（通常の縦スクロール）を横スクロールに変換
      const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX
      scrollContainerRef.current.scrollLeft += scrollAmount
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // キーボードの矢印キーでスクロール
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scrollContainerRef.current) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 矢印ボタンでスクロール
  const scrollLeft = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' })
  }

  const scrollRight = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' })
  }

  const fetchAssets = async (append = false) => {
    if (isLoadingMore && append) return

    if (append) setIsLoadingMore(true)

    try {
      // カタログAPIからデータを取得
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
            price: Math.floor(Math.random() * 30000) + 10000,
            creator: 'OWM Catalog',
            likes: Math.floor(Math.random() * 100),
            w: 400,
            h: 600,
            type: 'catalog'
          }))

          if (append) {
            setAssets(prev => {
              const existingIds = new Set(prev.map(a => a.id))
              const newAssets = catalogAssets.filter(a => !existingIds.has(a.id))
              return [...prev, ...newAssets]
            })
          } else {
            setAssets(catalogAssets) // 全データを一度に取得
          }
          setLoading(false)
          setIsLoadingMore(false)
          return
        }
      }

      // カタログが取得できない場合はpublished_itemsから取得
      const { data, error } = await supabase
        .from('published_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setAssets(data || [])
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }

  // 横スクロール検知
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return

      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth

      // 80%までスクロールしたら追加データを読み込み
      if (scrollPercentage > 0.8 && !isLoadingMore) {
        fetchAssets(true)
      }
    }

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [isLoadingMore])

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

      {/* Horizontal scroll container */}
      <div className="gallery-scroll-wrapper">
        <div className="gallery-scroll-container" ref={scrollContainerRef}>
          <div className="gallery-horizontal">
            {assets.map((asset, index) => {
              const template = posterTemplates[index % posterTemplates.length]
              return (
                <div key={asset.id} className="poster-item-horizontal" style={{ backgroundColor: template.bgColor }}>
                  <div className="poster-header">
                    <span className="poster-brand" style={{ color: template.textColor }}>
                      {index % 2 === 0 ? 'VERY PORTLAND' : 'form'}
                    </span>
                    <span className="poster-number" style={{ color: template.textColor }}>
                      {String(index + 1).padStart(3, '0')}
                    </span>
                  </div>
                  <div className="poster-image">
                    <img
                      src={asset.src}
                      alt={asset.title}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = 'https://via.placeholder.com/400x600/333/999?text=Fashion'
                      }}
                    />
                  </div>
                  <div className="poster-footer">
                    <div className="poster-title" style={{ color: template.textColor }}>
                      {asset.title || 'Untitled'}
                    </div>
                    <div className="poster-meta" style={{ color: template.textColor }}>
                      <span>{asset.creator || 'Anonymous'}</span>
                      <span>¥{asset.price?.toLocaleString() || '---'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {isLoadingMore && (
              <div className="loading-more">
                <div className="loading-spinner"></div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicators */}
        <div className="scroll-hint-left" onClick={scrollLeft}>←</div>
        <div className="scroll-hint-right" onClick={scrollRight}>→</div>
      </div>

      {/* Bottom white line */}
      <div className="bottom-line"></div>
    </div>
  )
}