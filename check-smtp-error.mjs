import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkSMTPError() {
  console.log('=== 🔍 SMTP設定エラーの詳細調査 ===\n')

  console.log('📋 可能性のある原因:\n')

  console.log('1. SMTP設定の保存が完了していない')
  console.log('   → Supabase Dashboardで「Save」ボタンを押したか確認')
  console.log('')

  console.log('2. Resend APIキーの問題')
  console.log('   → APIキーが正しく入力されているか確認')
  console.log('   → Resendダッシュボードでキーが有効か確認')
  console.log('')

  console.log('3. 送信元メールアドレスの問題')
  console.log('   → onboarding@resend.dev を使用しているか確認')
  console.log('   → 独自ドメインの場合はDNS設定が必要')
  console.log('')

  console.log('4. ポート番号の問題')
  console.log('   → 465 (SSL/TLS) または 587 (STARTTLS) を試す')
  console.log('')

  console.log('=== 🔧 解決策 ===\n')

  console.log('【ステップ1】Supabase Dashboardで以下を再確認:')
  console.log('  - Enable custom SMTP: ON')
  console.log('  - Host: smtp.resend.com')
  console.log('  - Port: 465')
  console.log('  - Username: resend')
  console.log('  - Password: re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP')
  console.log('  - Sender email: onboarding@resend.dev')
  console.log('  - Sender name: Open Wardrobe Market')
  console.log('')

  console.log('【ステップ2】設定を保存:')
  console.log('  - すべての項目を入力後、必ず「Save」をクリック')
  console.log('  - 保存成功のメッセージが表示されるまで待つ')
  console.log('')

  console.log('【ステップ3】別のポートを試す（465が動かない場合）:')
  console.log('  - Port を 587 に変更して保存')
  console.log('')

  console.log('【ステップ4】Resend側の確認:')
  console.log('  - https://resend.com/api-keys')
  console.log('  - APIキーが有効であることを確認')
  console.log('  - 使用制限に達していないか確認')
  console.log('')

  console.log('【ステップ5】一時的な解決策:')
  console.log('  - メール確認を無効化（開発環境のみ）')
  console.log('  - Supabase Dashboard → Authentication → Sign In / Providers')
  console.log('  - "Confirm email" をOFFにする')

  // 最近作成されたユーザーを確認
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 5
    })

    if (!error && users) {
      console.log('\n=== 📊 最近作成されたユーザー ===\n')
      users.slice(0, 3).forEach(user => {
        console.log(`📧 ${user.email}`)
        console.log(`  作成: ${new Date(user.created_at).toLocaleString()}`)
        console.log(`  確認: ${user.email_confirmed_at ? '✅' : '❌ 未確認'}`)
      })
    }
  } catch (err) {
    // エラーは無視
  }

  console.log('\n💡 ヒント:')
  console.log('Supabase Dashboardの Auth Logs をチェックすると')
  console.log('より詳細なエラーメッセージが確認できます。')
  console.log('Dashboard → Authentication → Logs')
}

checkSMTPError().then(() => process.exit())