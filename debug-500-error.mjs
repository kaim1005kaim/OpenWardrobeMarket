import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function debug500Error() {
  console.log('=== 🔍 500 Internal Server Error 調査 ===\n')

  console.log('📋 500エラーの可能性のある原因:\n')

  console.log('1. 無効なメールアドレス形式')
  console.log('   - テスト用の偽メールアドレスを使用した')
  console.log('   - 特殊文字が含まれている')
  console.log('   - ドメインがブロックされている\n')

  console.log('2. レート制限')
  console.log('   - 短時間に多くのアカウント作成を試みた')
  console.log('   - 同じIPから多数のリクエスト\n')

  console.log('3. SMTP設定の問題')
  console.log('   - Resend側でメール送信エラー')
  console.log('   - 送信先アドレスが拒否された\n')

  console.log('4. Supabase側の一時的な問題')
  console.log('   - サーバーエラー')
  console.log('   - データベース接続の問題\n')

  // 最近のユーザーを確認
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 10
    })

    if (!error && users) {
      console.log('=== 📊 最近作成されたユーザー ===\n')
      const recentUsers = users
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

      recentUsers.forEach(user => {
        const created = new Date(user.created_at)
        const now = new Date()
        const minutesAgo = Math.floor((now.getTime() - created.getTime()) / 1000 / 60)

        console.log(`📧 ${user.email}`)
        console.log(`  作成: ${minutesAgo}分前`)
        console.log(`  確認: ${user.email_confirmed_at ? '✅' : '❌ 未確認'}`)
        console.log(`  プロバイダー: ${user.app_metadata?.provider || 'email'}\n`)
      })
    }
  } catch (err) {
    console.error('ユーザー取得エラー:', err)
  }

  console.log('=== 🔧 解決方法 ===\n')

  console.log('【1. 有効なメールアドレスを使用】')
  console.log('✅ 実在するメールアドレスを使用')
  console.log('✅ 個人のGmailアドレスなど')
  console.log('❌ test@test.com などは避ける\n')

  console.log('【2. 時間を置いてから再試行】')
  console.log('5-10分待ってから再度試す\n')

  console.log('【3. ブラウザの開発者ツールでエラー詳細を確認】')
  console.log('Network タブ → signup リクエスト → Response を確認\n')

  console.log('【4. 別のテスト方法】')
  console.log('以下のスクリプトで直接テスト:')
  console.log('```bash')
  console.log('node test-with-real-email.mjs <あなたのメール>')
  console.log('```\n')

  console.log('【5. 一時的な回避策】')
  console.log('Supabase Dashboard → Authentication → Sign In / Providers')
  console.log('→ "Confirm email" を一時的にOFFにする')
  console.log('（開発環境のみ）')
}

debug500Error().then(() => process.exit())