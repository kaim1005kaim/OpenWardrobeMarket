import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testEmailSending() {
  console.log('=== 📧 メール送信テスト ===\n')

  const testEmail = 'owmtest' + Date.now() + '@gmail.com'
  const testPassword = 'TestPassword123!'
  const testUsername = 'test_user_' + Date.now()

  console.log('テストアカウント情報:')
  console.log('  Email:', testEmail)
  console.log('  Username:', testUsername)
  console.log('')

  try {
    console.log('アカウント作成中...')

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername
        },
        emailRedirectTo: `${process.env.VERCEL_URL || 'http://localhost:5173'}/auth/callback`
      }
    })

    if (error) {
      console.error('❌ エラー:', error.message)
      return
    }

    console.log('\n✅ アカウント作成成功!')
    console.log('  ユーザーID:', data.user?.id)
    console.log('  メール:', data.user?.email)
    console.log('  確認状態:', data.user?.email_confirmed_at ? '確認済み' : '未確認')

    console.log('\n📨 結果:')
    if (data.user?.email_confirmed_at) {
      console.log('  メール確認は不要です（自動確認済み）')
    } else {
      console.log('  確認メールが送信されました！')
      console.log('  メールボックスを確認してください: ' + testEmail)
      console.log('  ※ 迷惑メールフォルダも確認してください')
    }

    console.log('\n=== Supabaseメール設定 ===\n')
    console.log('現在の状況:')
    console.log('  - Supabaseのデフォルトメールサービス使用中')
    console.log('  - 制限: 1時間あたり3通まで')
    console.log('')
    console.log('メールが届かない場合:')
    console.log('  1. Supabase Dashboardにログイン')
    console.log('  2. Authentication → Email Templates を確認')
    console.log('  3. テストメール送信機能を使用')
    console.log('')
    console.log('本番環境では:')
    console.log('  カスタムSMTP（SendGrid、Resend等）の設定を推奨')

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }
}

testEmailSending().then(() => process.exit())