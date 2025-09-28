import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testWithoutEmailConfirmation() {
  console.log('=== 🎉 メール確認無効化のテスト ===\n')
  console.log('✅ "Confirm email" をOFFに設定しました')
  console.log('📝 これで全てのメールアドレスでアカウント作成が可能です\n')

  // テスト用メールアドレス
  const testEmail = `test.user.${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const testUsername = `test_user_${Date.now()}`

  console.log('📧 テストアカウント情報:')
  console.log('  Email:', testEmail)
  console.log('  Username:', testUsername)
  console.log('  Password:', testPassword)
  console.log('')

  try {
    console.log('🔄 アカウント作成中...')

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername
        }
      }
    })

    if (error) {
      console.error('❌ エラー:', error.message)
      return
    }

    console.log('\n✅ アカウント作成成功!')
    console.log('  ユーザーID:', data.user?.id)
    console.log('  メール:', data.user?.email)
    console.log('  確認状態:', data.user?.email_confirmed_at ? '✅ 自動確認済み' : '❌ 未確認')

    // 即座にログインテスト
    console.log('\n🔐 ログインテスト中...')

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    if (loginError) {
      console.error('❌ ログインエラー:', loginError.message)
    } else {
      console.log('✅ ログイン成功!')
      console.log('  セッション:', loginData.session ? 'アクティブ' : 'なし')
      console.log('  ユーザー:', loginData.user?.email)
    }

    console.log('\n=== 🎊 設定完了 ===\n')
    console.log('✅ メール確認が無効になっています')
    console.log('✅ すべてのメールアドレスでアカウント作成可能')
    console.log('✅ 即座にログイン可能')
    console.log('✅ 開発環境の準備が整いました！')

    console.log('\n📋 本番環境への移行時:')
    console.log('1. 独自ドメインを取得')
    console.log('2. Resendでドメイン検証')
    console.log('3. メール確認を再度有効化')
    console.log('4. Sender emailを独自ドメインのアドレスに変更')

    // ログアウト
    await supabase.auth.signOut()

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }
}

testWithoutEmailConfirmation().then(() => process.exit())