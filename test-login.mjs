import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLogin() {
  console.log('=== 🔐 ログインテスト ===\n')

  // テスト用の新規アカウントを作成
  const testEmail = `test.${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const testUsername = `test_user_${Date.now()}`

  console.log('1️⃣ 新規アカウント作成')
  console.log('  Email:', testEmail)
  console.log('  Password:', testPassword)
  console.log('')

  try {
    // アカウント作成
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername
        }
      }
    })

    if (signupError) {
      console.error('❌ サインアップエラー:', signupError.message)
      return
    }

    console.log('✅ アカウント作成成功')
    console.log('  ユーザーID:', signupData.user?.id)
    console.log('  確認状態:', signupData.user?.email_confirmed_at ? '確認済み' : '未確認')
    console.log('')

    // 即座にログインテスト
    console.log('2️⃣ ログインテスト')

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    if (loginError) {
      console.error('❌ ログインエラー:', loginError.message)

      if (loginError.message.includes('Invalid login credentials')) {
        console.log('\n📋 考えられる原因:')
        console.log('1. パスワードが間違っている')
        console.log('2. メールアドレスが間違っている')
        console.log('3. アカウントが存在しない')
        console.log('4. メール確認が必要（現在はOFFのはず）')
      }
      return
    }

    console.log('✅ ログイン成功!')
    console.log('  セッション:', loginData.session ? 'アクティブ' : 'なし')
    console.log('  ユーザー:', loginData.user?.email)
    console.log('')

    // ログアウト
    await supabase.auth.signOut()
    console.log('✅ ログアウト完了')

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }

  console.log('\n=== 📝 トラブルシューティング ===\n')
  console.log('既存アカウントでログインできない場合:')
  console.log('1. パスワードをリセット（パスワードリセット機能を実装）')
  console.log('2. 新規アカウントを作成')
  console.log('3. Supabase Dashboardでユーザーを確認')
  console.log('')
  console.log('Supabase Dashboard → Authentication → Users')
  console.log('https://supabase.com/dashboard/project/etvmigcsvrvetemyeiez/auth/users')
}

testLogin().then(() => process.exit())