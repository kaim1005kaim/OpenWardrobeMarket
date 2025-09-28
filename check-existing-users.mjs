import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkExistingUsers() {
  console.log('=== 🔍 既存ユーザー確認 ===\n')

  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('❌ ユーザー取得エラー:', error)
      return
    }

    console.log(`📊 登録ユーザー数: ${users?.length || 0}\n`)

    // 最近作成されたユーザー（直近10件）
    const recentUsers = users
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    console.log('=== 最近のユーザー（新しい順）===\n')

    recentUsers?.forEach((user, index) => {
      const created = new Date(user.created_at)
      const now = new Date()
      const hoursAgo = Math.floor((now.getTime() - created.getTime()) / 1000 / 60 / 60)
      const minutesAgo = Math.floor((now.getTime() - created.getTime()) / 1000 / 60) % 60

      console.log(`${index + 1}. ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   作成: ${hoursAgo}時間${minutesAgo}分前`)
      console.log(`   確認: ${user.email_confirmed_at ? '✅ 確認済み' : '❌ 未確認'}`)
      console.log(`   プロバイダー: ${user.app_metadata?.provider || 'email'}`)

      // プロファイル確認
      if (user.user_metadata?.username) {
        console.log(`   ユーザー名: ${user.user_metadata.username}`)
      }

      console.log('')
    })

    console.log('=== 💡 ログインできない場合の対処法 ===\n')
    console.log('1. **パスワードを忘れた場合**')
    console.log('   → 新しいアカウントを作成してください\n')

    console.log('2. **メールアドレスが分からない場合**')
    console.log('   → 上記リストから確認してください\n')

    console.log('3. **それでもログインできない場合**')
    console.log('   → 新規アカウントを作成してテストしてください')
    console.log('   → Email: your.email@example.com')
    console.log('   → Password: TestPassword123!')

  } catch (err) {
    console.error('❌ エラー:', err)
  }
}

checkExistingUsers().then(() => process.exit())