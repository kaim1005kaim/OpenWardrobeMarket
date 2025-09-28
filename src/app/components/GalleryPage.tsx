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
  const [username, setUsername] = useState<string>('')
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

  // 無限スクロール検知
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = document.documentElement.clientHeight

      if (scrollTop + clientHeight >= scrollHeight - 500 && !isLoadingMore) {
        fetchAssets(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isLoadingMore])

  // ランダムな高さを生成（Pinterest風のレイアウト用）
  const getRandomHeight = (index: number) => {
    const heights = [250, 300, 350, 400, 320, 280, 360]
    return heights[index % heights.length]
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

      {/* Masonry Grid Container */}
      <div className="gallery-masonry-wrapper">
        <div className="gallery-masonry-grid">
          {assets.map((asset, index) => {
            const template = posterTemplates[index % posterTemplates.length]
            return (
              <div
                key={asset.id}
                className="masonry-item"
                style={{
                  backgroundColor: template.bgColor,
                  height: `${getRandomHeight(index)}px`
                }}
              >
                <div className="masonry-image">
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
                <div className="masonry-overlay">
                  <div className="masonry-title" style={{ color: template.textColor }}>
                    {asset.title || 'Untitled'}
                  </div>
                  <div className="masonry-meta" style={{ color: template.textColor }}>
                    <span>{asset.creator || 'Anonymous'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {isLoadingMore && (
          <div className="loading-more-masonry">
            <div className="loading-spinner"></div>
          </div>
        )}
      </div>

      {/* Bottom white line */}
      <div className="bottom-line"></div>
    </div>
  )
}