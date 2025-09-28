import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addSampleData() {
  console.log('=== 🎨 サンプルギャラリーデータ追加 ===\n')

  try {
    // 最初のユーザーIDを取得
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    })

    if (usersError || !users || users.length === 0) {
      console.error('❌ ユーザーが見つかりません')
      return
    }

    const userId = users[0].id
    console.log('📧 データ作成ユーザー:', users[0].email)
    console.log('')

    // サンプル画像データを作成
    const sampleImages = [
      {
        user_id: userId,
        r2_url: 'https://via.placeholder.com/400x600/FF8C42/FFFFFF?text=Fashion+1',
        r2_key: 'sample-1',
        title: 'Urban Street Style',
        description: 'モダンなストリートファッション',
        width: 400,
        height: 600,
        size: 50000,
        mime_type: 'image/jpeg',
        tags: ['street', 'urban', 'modern'],
        colors: ['orange', 'white'],
        price: 15000,
        is_public: true
      },
      {
        user_id: userId,
        r2_url: 'https://via.placeholder.com/400x600/C73E1D/FFE66D?text=Fashion+2',
        r2_key: 'sample-2',
        title: 'Vintage Collection',
        description: 'レトロヴィンテージスタイル',
        width: 400,
        height: 600,
        size: 50000,
        mime_type: 'image/jpeg',
        tags: ['vintage', 'retro', 'classic'],
        colors: ['red', 'yellow'],
        price: 18000,
        is_public: true
      },
      {
        user_id: userId,
        r2_url: 'https://via.placeholder.com/400x600/4169E1/FFFFFF?text=Fashion+3',
        r2_key: 'sample-3',
        title: 'Minimal Design',
        description: 'シンプルでクリーンなデザイン',
        width: 400,
        height: 600,
        size: 50000,
        mime_type: 'image/jpeg',
        tags: ['minimal', 'clean', 'simple'],
        colors: ['blue', 'white'],
        price: 12000,
        is_public: true
      },
      {
        user_id: userId,
        r2_url: 'https://via.placeholder.com/400x600/FF6347/000000?text=Fashion+4',
        r2_key: 'sample-4',
        title: 'Bold Statement',
        description: '大胆なステートメントピース',
        width: 400,
        height: 600,
        size: 50000,
        mime_type: 'image/jpeg',
        tags: ['bold', 'statement', 'artistic'],
        colors: ['tomato', 'black'],
        price: 25000,
        is_public: true
      }
    ]

    // imagesテーブルに挿入
    console.log('📝 画像データを作成中...')
    const { data: insertedImages, error: imagesError } = await supabase
      .from('images')
      .insert(sampleImages)
      .select()

    if (imagesError) {
      console.error('❌ 画像データ作成エラー:', imagesError)
      return
    }

    console.log(`✅ ${insertedImages.length}件の画像データを作成しました`)

    // published_itemsテーブルに挿入
    const publishedItems = insertedImages.map(img => ({
      user_id: userId,
      image_id: img.id,
      title: img.title,
      description: img.description,
      price: img.price,
      tags: img.tags,
      colors: img.colors,
      category: 'fashion',
      is_active: true
    }))

    console.log('📦 出品データを作成中...')
    const { data: insertedPublished, error: publishedError } = await supabase
      .from('published_items')
      .insert(publishedItems)
      .select()

    if (publishedError) {
      console.error('❌ 出品データ作成エラー:', publishedError)
      return
    }

    console.log(`✅ ${insertedPublished.length}件の出品データを作成しました`)

    // 確認
    const { count } = await supabase
      .from('published_items')
      .select('*', { count: 'exact', head: true })

    console.log(`\n📊 合計出品数: ${count}件`)

    console.log('\n🎉 サンプルデータ追加完了!')
    console.log('ギャラリーページをリロードすると表示されます。')

  } catch (err) {
    console.error('❌ エラー:', err)
  }
}

addSampleData().then(() => process.exit())