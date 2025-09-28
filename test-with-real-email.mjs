import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testWithRealEmail() {
  const email = process.argv[2]

  if (!email) {
    console.log('使用方法: node test-with-real-email.mjs <メールアドレス>')
    console.log('例: node test-with-real-email.mjs your.email@gmail.com')
    process.exit(1)
  }

  console.log('=== 📧 実際のメールアドレスでテスト ===\n')

  // メールアドレスの検証
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(email)) {
    console.error('❌ 無効なメールアドレス形式です')
    process.exit(1)
  }

  // ブロックされるパターンをチェック
  const blockedPatterns = ['test@test', 'example@example', 'aaa@aaa']
  const isBlocked = blockedPatterns.some(pattern => email.toLowerCase().includes(pattern))

  if (isBlocked) {
    console.error('❌ このメールアドレスはブロックされています')
    console.log('実際のメールアドレスを使用してください')
    process.exit(1)
  }

  const testPassword = 'TestPassword123!'
  const testUsername = `owm_user_${Date.now()}`

  console.log('📝 アカウント情報:')
  console.log('  Email:', email)
  console.log('  Username:', testUsername)
  console.log('')

  try {
    console.log('🔄 アカウント作成中...')

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: testPassword,
      options: {
        data: {
          username: testUsername
        },
        emailRedirectTo: `http://localhost:5173/auth/callback`
      }
    })

    if (error) {
      console.error('\n❌ エラー:', error.message)

      if (error.message.includes('500') || error.message.includes('Internal')) {
        console.log('\n📋 500エラーの対処法:')
        console.log('1. 5-10分待ってから再試行')
        console.log('2. 別のメールアドレスを使用')
        console.log('3. Supabase Dashboard → Logs でエラー詳細を確認')
      } else if (error.message.includes('already registered')) {
        console.log('\n⚠️  このメールは既に登録済みです')
        console.log('別のメールアドレスを使用してください')
      } else if (error.message.includes('rate')) {
        console.log('\n⚠️  レート制限に達しました')
        console.log('しばらく待ってから再試行してください')
      }

      return
    }

    console.log('\n✅ アカウント作成成功!')
    console.log('  ユーザーID:', data.user?.id)
    console.log('  メール:', data.user?.email)
    console.log('  確認状態:', data.user?.email_confirmed_at ? '確認済み' : '未確認')

    if (!data.user?.email_confirmed_at) {
      console.log('\n📬 確認メールを送信しました!')
      console.log('メールボックスを確認してください:', email)
      console.log('（SPAMフォルダも確認してください）')
    }

    console.log('\n✅ Resend SMTP設定は正常に動作しています')

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }
}

testWithRealEmail()