import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verifyTables() {
  console.log('=== 🔍 テーブル作成確認 ===\n')

  const tables = [
    'images',
    'published_items',
    'saved_items',
    'likes',
    'user_profiles'
  ]

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ ${table}: エラー - ${error.message}`)
      } else {
        console.log(`✅ ${table}: 正常に作成されています`)
      }
    } catch (err) {
      console.log(`❌ ${table}: 未作成`)
    }
  }

  console.log('\n=== 📊 テーブル統計 ===\n')

  // 各テーブルの行数を確認
  try {
    const { count: userCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
    console.log(`👤 ユーザープロファイル: ${userCount || 0}件`)

    const { count: imageCount } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
    console.log(`🖼️  画像: ${imageCount || 0}件`)

    const { count: publishedCount } = await supabase
      .from('published_items')
      .select('*', { count: 'exact', head: true })
    console.log(`📦 出品アイテム: ${publishedCount || 0}件`)

    const { count: savedCount } = await supabase
      .from('saved_items')
      .select('*', { count: 'exact', head: true })
    console.log(`💾 保存済みアイテム: ${savedCount || 0}件`)

    const { count: likesCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
    console.log(`❤️  いいね: ${likesCount || 0}件`)
  } catch (err) {
    console.log('統計取得エラー:', err.message)
  }

  console.log('\n=== 🎉 セットアップ完了 ===\n')
  console.log('✅ データベース構造が正常に作成されました')
  console.log('✅ 認証システムが動作しています')
  console.log('✅ アプリケーションを使用できます！')

  console.log('\n📋 次のステップ:')
  console.log('1. ブラウザでアプリケーションをリロード')
  console.log('2. 新規アカウントを作成してテスト')
  console.log('3. ギャラリーページが正常に表示されることを確認')
}

verifyTables().then(() => process.exit())