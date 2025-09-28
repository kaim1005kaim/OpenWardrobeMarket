import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupEmailConfirmation() {
  console.log('=== 📧 メール確認設定 ===\n')

  try {
    // 1. 現在の未確認ユーザーを取得
    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('❌ ユーザー取得エラー:', error)
      return
    }

    const unconfirmedUsers = users?.filter(u =>
      !u.email_confirmed_at &&
      u.app_metadata?.provider === 'email'
    ) || []

    console.log(`📊 未確認メールアカウント: ${unconfirmedUsers.length}個\n`)

    if (unconfirmedUsers.length > 0) {
      console.log('未確認ユーザー:')
      for (const user of unconfirmedUsers) {
        console.log(`  - ${user.email} (${user.id})`)
        console.log(`    作成日時: ${new Date(user.created_at).toLocaleString()}`)
      }
      console.log('')
    }

    // 2. 確認メールの再送信
    console.log('=== 確認メールの再送信 ===\n')

    for (const user of unconfirmedUsers) {
      console.log(`📨 ${user.email} に確認メールを送信中...`)

      // Resend confirmation email using the admin API
      const { error: resendError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: user.email,
        options: {
          redirectTo: `${process.env.VERCEL_URL || 'http://localhost:5173'}/auth/callback`
        }
      })

      if (resendError) {
        console.error(`  ❌ エラー: ${resendError.message}`)
      } else {
        console.log(`  ✅ 送信成功`)
      }
    }

    console.log('\n=== 推奨設定 ===\n')
    console.log('Supabase Dashboardで以下を確認してください:\n')
    console.log('1. Authentication → Settings → Email Auth')
    console.log('   - "Enable email confirmations" が有効')
    console.log('   - SMTP設定が正しく構成されている')
    console.log('')
    console.log('2. Authentication → Email Templates')
    console.log('   - Confirm signup テンプレートが設定されている')
    console.log('   - リダイレクトURLが正しい')
    console.log('')
    console.log('3. 開発環境では:')
    console.log('   - Supabase内蔵のメールサービスを使用（制限あり）')
    console.log('   - または外部SMTPサービス（SendGrid、Resend等）を設定')

    console.log('\n=== メール送信テスト用コード ===\n')
    console.log('以下のコードでメール送信をテストできます:')
    console.log(`
// テスト用アカウント作成
const testEmail = 'test' + Date.now() + '@example.com'
const { data, error } = await supabase.auth.signUp({
  email: testEmail,
  password: 'TestPassword123!',
  options: {
    emailRedirectTo: window.location.origin + '/auth/callback'
  }
})

if (error) {
  console.error('Error:', error)
} else {
  console.log('Check email:', testEmail)
  console.log('User:', data)
}
`)

  } catch (err) {
    console.error('❌ スクリプトエラー:', err)
  }
}

setupEmailConfirmation().then(() => process.exit())