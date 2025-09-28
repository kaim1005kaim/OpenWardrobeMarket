import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function confirmEmailManually() {
  const email = process.argv[2]

  if (!email) {
    console.log('使用方法: node confirm-email-manually.mjs <email>')
    console.log('例: node confirm-email-manually.mjs test@example.com')
    process.exit(1)
  }

  console.log(`\n📧 ${email} のメール確認を手動で実行...\n`)

  try {
    // Find user
    const { data: { users }, error: searchError } = await supabase.auth.admin.listUsers()

    if (searchError) {
      console.error('❌ ユーザー検索エラー:', searchError)
      return
    }

    const user = users?.find(u => u.email === email)

    if (!user) {
      console.error(`❌ ユーザーが見つかりません: ${email}`)
      return
    }

    if (user.email_confirmed_at) {
      console.log(`✅ すでに確認済みです`)
      console.log(`  確認日時: ${new Date(user.email_confirmed_at).toLocaleString()}`)
      return
    }

    // Update user to confirm email
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        email_confirmed_at: new Date().toISOString()
      }
    )

    if (error) {
      console.error('❌ 更新エラー:', error)
      return
    }

    console.log(`✅ メール確認が完了しました!`)
    console.log(`  ユーザーID: ${user.id}`)
    console.log(`  Email: ${email}`)
    console.log(`  確認日時: ${new Date().toLocaleString()}`)
    console.log(`\nこのユーザーはログインできるようになりました。`)

  } catch (err) {
    console.error('❌ エラー:', err)
  }
}

confirmEmailManually().then(() => process.exit())