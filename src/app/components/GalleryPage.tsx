import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Asset } from '../lib/types'
import { useNavigate } from 'react-router-dom'
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
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [username, setUsername] = useState<string>('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAssets()
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUsername(user.user_metadata?.username || user.email?.split('@')[0] || 'User')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

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

  // ドラッグ＆スワイプ機能（慣性なし）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return
    e.preventDefault()
    setIsDragging(true)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollContainerRef.current) return
    setIsDragging(true)
    setStartX(e.touches[0].pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 1.5 // スムーズな移動
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 1.5
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

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
  const scrollToLeft = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' })
  }

  const scrollToRight = () => {
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
          // カタログ画像をAsset形式に変換（全データ取得）
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

          // 全データを設定（appendは無視して全件取得）
          setAssets(catalogAssets)
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
        .limit(10000)

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
      {/* Header with logo and account info */}
      <div className="gallery-header">
        <div className="logo-text">OPENWARDROBEMARKET</div>
        <div className="account-info">
          <span className="username">{username}</span>
          <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
        </div>
      </div>

      {/* Top white line */}
      <div className="top-line"></div>

      {/* Horizontal scroll container */}
      <div className="gallery-scroll-wrapper">
        <div
          className={`gallery-scroll-container ${isDragging ? 'dragging' : ''}`}
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}>
          <div className="gallery-horizontal">
            {assets.map((asset, index) => {
              const template = posterTemplates[index % posterTemplates.length]
              return (
                <div key={asset.id} className="poster-item-horizontal" style={{ backgroundColor: template.bgColor }} onMouseDown={(e) => e.stopPropagation()}>
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
        <div className="scroll-hint-left" onClick={scrollToLeft}>←</div>
        <div className="scroll-hint-right" onClick={scrollToRight}>→</div>
      </div>

      {/* Bottom white line */}
      <div className="bottom-line"></div>
    </div>
  )
}