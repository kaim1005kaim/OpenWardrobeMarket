import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeMigration() {
  console.log('=== 📦 Published Itemsテーブル作成 ===\n')

  try {
    // SQLファイルを読み込み
    const sqlPath = '/Volumes/SSD02/Private/Dev/OpenWardrobeMarket/migrations/create_published_items.sql'
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('📝 SQLを実行中...')

    // SQLを実行
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    }).single()

    if (error) {
      // exec_sql関数が存在しない場合は、Supabase SQL Editorで実行する必要がある
      console.log('\n⚠️  Supabase SQL Editorで実行してください:\n')
      console.log('1. Supabase Dashboard にログイン')
      console.log('2. SQL Editor を開く')
      console.log('3. 以下のSQLを貼り付けて実行:\n')
      console.log('------- SQL START -------')
      console.log(sql)
      console.log('------- SQL END -------')

      console.log('\n🔗 直接リンク:')
      console.log('https://supabase.com/dashboard/project/etvmigcsvrvetemyeiez/sql/new')

      return
    }

    console.log('✅ テーブル作成成功!')

    // テーブルが存在することを確認
    const { data: testData, error: testError } = await supabase
      .from('published_items')
      .select('*')
      .limit(1)

    if (testError) {
      console.error('❌ テーブル確認エラー:', testError)
    } else {
      console.log('✅ published_itemsテーブルが正常に作成されました')
      console.log('📊 現在の行数:', testData?.length || 0)
    }

    console.log('\n🎉 完了!')
    console.log('ギャラリーページが正常に動作するようになりました。')

  } catch (err) {
    console.error('❌ エラー:', err)
    console.log('\n💡 手動で実行してください:')
    console.log('Supabase Dashboard → SQL Editor で上記のSQLを実行')
  }
}

executeMigration().then(() => process.exit())