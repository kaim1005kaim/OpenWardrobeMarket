import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSMTPPort587() {
  console.log('=== 📧 SMTP設定テスト (Port 587) ===\n')
  console.log('✅ ポート番号を587に変更して保存しました')
  console.log('📝 現在の設定:')
  console.log('  Host: smtp.resend.com')
  console.log('  Port: 587')
  console.log('  Username: resend')
  console.log('  Sender: onboarding@resend.dev')
  console.log('')

  // 実際のメールアドレスを使用（あなたのGmailアドレス）
  const realEmail = 'kai.moriguchi1005@gmail.com'
  const testPassword = 'TestPassword123!'
  const testUsername = `owm_user_${Date.now()}`

  console.log('🔄 実際のメールアドレスでテスト:')
  console.log('  Email:', realEmail)
  console.log('  Username:', testUsername)
  console.log('')

  try {
    console.log('📨 アカウント作成＆メール送信中...')

    const { data, error } = await supabase.auth.signUp({
      email: realEmail,
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

      if (error.message.includes('Error sending confirmation email')) {
        console.log('\n⚠️  SMTP設定にまだ問題があるようです')
        console.log('\n📋 次の対策:')
        console.log('1. Supabase Dashboard → Authentication → Emails')
        console.log('2. 以下を再確認:')
        console.log('   - すべてのフィールドが正しく入力されているか')
        console.log('   - Passwordフィールドに余分なスペースがないか')
        console.log('3. 一度Custom SMTPをOFFにして保存')
        console.log('4. 再度ONにして全項目を入力し直す')
      } else if (error.message.includes('already registered')) {
        console.log('\n⚠️  このメールアドレスは既に登録済みです')
        console.log('   別のメールアドレスでお試しください')
      }

      return
    }

    console.log('\n🎉 成功!')
    console.log('  ユーザーID:', data.user?.id)
    console.log('  メール:', data.user?.email)
    console.log('  確認状態:', data.user?.email_confirmed_at ? '確認済み' : '未確認')

    if (!data.user?.email_confirmed_at) {
      console.log('\n✅ Resend SMTP経由でメールが送信されました!')
      console.log('📬 メールボックスを確認してください:', realEmail)
      console.log('💡 メールが届かない場合:')
      console.log('  - SPAMフォルダを確認')
      console.log('  - 数分待ってから再確認')
      console.log('  - Resend Dashboard (https://resend.com/emails) で送信ログを確認')
    } else {
      console.log('\n✅ メール確認が無効になっている可能性があります')
    }

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }

  console.log('\n=== 📊 設定状況 ===')
  console.log('✅ SMTP設定は保存済み (Port 587)')
  console.log('📧 テストメール送信を実行')
  console.log('🔍 Audit Logsでエラーの詳細を確認可能')
}

testSMTPPort587().then(() => process.exit())