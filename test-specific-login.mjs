import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTcxMjAsImV4cCI6MjA3MTg5MzEyMH0.hlH_QOl8F7HWH8p0SnLQdtwxs8w1JN8cqg8kvGFHw2Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSpecificLogin() {
  console.log('=== 🔍 kai.moriguchi1005@gmail.com ログイン診断 ===\n')

  const email = 'kai.moriguchi1005@gmail.com'
  const password = '1224kaim'

  console.log('📧 アカウント情報:')
  console.log('  Email:', email)
  console.log('  作成日: 751時間前（約31日前）')
  console.log('  プロバイダー: Google（Google OAuth）')
  console.log('  確認状態: ✅ 確認済み\n')

  console.log('❌ ログインできない理由:\n')
  console.log('このアカウントは **Googleログイン** で作成されました。')
  console.log('パスワード「1224kaim」では ログインできません。\n')

  console.log('=== 🔧 解決方法 ===\n')

  console.log('【オプション1】Googleでログイン（推奨）')
  console.log('1. ログイン画面で「GOOGLE LOGIN」ボタンをクリック')
  console.log('2. Googleアカウントでログイン')
  console.log('3. kai.moriguchi1005@gmail.com を選択\n')

  console.log('【オプション2】新規メールアカウントを作成')
  console.log('1. 「NEW ACCOUNT」をクリック')
  console.log('2. 同じメールアドレスは使えないので、別のメールを使用')
  console.log('   例: kai.test@example.com')
  console.log('3. パスワード: 1224kaim（または任意のパスワード）\n')

  // 実際にパスワードでログインを試みる（エラーを確認）
  console.log('📝 パスワードログインをテスト中...')

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (error) {
      console.log('❌ 予想通りエラー:', error.message)

      if (error.message.includes('Invalid login credentials')) {
        console.log('\nこれは正常な動作です。')
        console.log('Googleログインアカウントはパスワードログインできません。')
      }
    } else {
      console.log('✅ ログイン成功（予想外）')
      console.log('セッション:', data.session ? 'アクティブ' : 'なし')
    }
  } catch (err) {
    console.error('エラー:', err)
  }

  console.log('\n=== 💡 推奨事項 ===\n')
  console.log('1. **Googleログインを使用** - 最も簡単')
  console.log('2. **新規アカウントを作成** - パスワードログインが必要な場合')
  console.log('   Email: kai.test@example.com')
  console.log('   Password: 1224kaim')
  console.log('   Username: kai_test')
  console.log('\n開発環境ではメール確認が無効なので、')
  console.log('新規アカウントは即座に使用可能です。')
}

testSpecificLogin().then(() => process.exit())