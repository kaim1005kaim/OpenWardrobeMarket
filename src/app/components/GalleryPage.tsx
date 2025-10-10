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
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'clean' | 'poster'>('poster')
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

  // アスペクト比を決定（正方形、縦長の2種類をランダムに）
  const getAspectRatio = (index: number) => {
    // ランダムなパターンを生成（シードを使って再現性を持たせる）
    const seed = index * 2654435761 % 2147483647
    const random = (seed / 2147483647)

    // 40%の確率で正方形、60%の確率で縦長
    if (random < 0.4) {
      return { type: 'square', height: 320 }  // 1:1 (高さを増やして画像部分を正方形に)
    } else {
      return { type: 'portrait', height: 460 } // 9:16
    }
  }

  return (
    <div className="gallery-container">
      {/* Header */}
      <div className="gallery-header">
        <button className="hamburger-menu" onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
        <h1 className="gallery-title">GALLERY</h1>
        <div className="header-spacer"></div>
      </div>

      {/* Side Menu */}
      <div className={`side-menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <button className="close-menu" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <nav className="menu-nav">
          <a href="#">HOME</a>
          <a href="#">GALLERY</a>
          <a href="#">CREATE</a>
          <a href="#">PROFILE</a>
        </nav>
        <div className="menu-footer">
          <span className="username">{username}</span>
          <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
        </div>
      </div>

      {/* Masonry Grid Container */}
      <div className="gallery-masonry-wrapper">
        <div className="gallery-masonry-grid">
          {assets.map((asset, index) => {
            const template = posterTemplates[index % posterTemplates.length]
            const aspectRatio = getAspectRatio(index)
            return (
              <div
                key={asset.id}
                className={`masonry-item ${aspectRatio.type}`}
                style={{
                  backgroundColor: template.bgColor,
                  height: `${aspectRatio.height}px`
                }}
              >
                <div className="poster-frame" onClick={() => setSelectedAsset(asset)}>
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

      {/* Detail Modal */}
      {selectedAsset && (
        <div className="detail-modal" onClick={() => setSelectedAsset(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedAsset(null)}>×</button>
            <div className="modal-image">
              <img src={selectedAsset.src} alt={selectedAsset.title} />
            </div>
            <div className="modal-info">
              <h2 className="modal-title">{selectedAsset.title || 'Untitled'}</h2>
              <div className="modal-meta">
                <p className="modal-description">
                  2000S A FULL-BODY SHOT OF<br />
                  GARETH PUGH STYLE<br />
                  FEATURE
                </p>
                <div className="modal-tags">
                  <span>黒</span>
                  <span>赤</span>
                  <span>黄</span>
                  <span>緑</span>
                  <span>青</span>
                </div>
                <p className="modal-details">
                  ゴシック / MIDJOURNEY & RUNWAY・クリエイティブ / 独特なスタイル模索中<br />
                  フィギュア / ティーボット・アブストラクト / 抽象的でティーポットをイメージして<br />
                  かす。
                </p>
              </div>
              <div className="modal-price">
                <span className="price-label">from<br />JOHN DEANNA</span>
                <span className="price-amount">¥{selectedAsset.price?.toLocaleString() || '5,000'}</span>
              </div>
              <button className="purchase-btn">Similar designs</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}