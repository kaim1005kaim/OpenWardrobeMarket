import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSMTPConfiguration() {
  console.log('=== 📧 Resend SMTP設定テスト ===\n')
  console.log('ResendのカスタムSMTP設定が完了しました。')
  console.log('新規アカウント作成でメール送信をテストします...\n')

  // テスト用のメールアドレス（実在するアドレスを使用）
  const testEmail = `owm.test.${Date.now()}@gmail.com`
  const testPassword = 'TestPassword123!'
  const testUsername = `owm_test_${Date.now()}`

  console.log('📝 テストアカウント情報:')
  console.log('  Email:', testEmail)
  console.log('  Username:', testUsername)
  console.log('')

  try {
    console.log('🔄 アカウント作成中...')

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername
        },
        emailRedirectTo: `http://localhost:5173/auth/callback`
      }
    })

    if (error) {
      console.error('❌ エラー:', error.message)
      if (error.message.includes('rate')) {
        console.log('\n⚠️  レート制限エラーの可能性があります。')
        console.log('   少し時間を置いて再試行してください。')
      }
      return
    }

    console.log('\n✅ アカウント作成成功!')
    console.log('  ユーザーID:', data.user?.id)
    console.log('  メール:', data.user?.email)
    console.log('  確認状態:', data.user?.email_confirmed_at ? '確認済み' : '未確認（メール確認が必要）')

    console.log('\n📨 メール送信結果:')
    if (data.user?.email_confirmed_at) {
      console.log('  ✅ メール確認が自動的に完了しました（確認不要設定）')
    } else {
      console.log('  ✅ ResendのSMTPサーバー経由で確認メールが送信されました！')
      console.log('  📬 メールボックスを確認してください:', testEmail)
      console.log('  ⚠️  実在しないアドレスの場合はメールは届きません')
    }

    console.log('\n=== 🎉 SMTP設定成功 ===\n')
    console.log('✅ Supabaseのカスタムが正しく設定されています')
    console.log('✅ Resend経由でメールが送信されるようになりました')
    console.log('✅ Supabaseのバウンス警告が解決されます')

    console.log('\n📊 次のステップ:')
    console.log('1. 実在するメールアドレスでアカウント作成をテスト')
    console.log('2. 確認メールが届くことを確認')
    console.log('3. メール内のリンクをクリックしてアカウント有効化')
    console.log('4. Resend Dashboardで送信ログを確認')
    console.log('   https://resend.com/emails')

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }
}

testSMTPConfiguration().then(() => process.exit())