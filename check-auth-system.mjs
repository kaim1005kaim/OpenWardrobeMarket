import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etvmigcsvrvetemyeiez.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dm1pZ2NzdnJ2ZXRlbXllaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMxNzEyMCwiZXhwIjoyMDcxODkzMTIwfQ.MAAFbXuCcl9UkW0WB54OBjte5UhWTJQg4ToxHBH5Kq0'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAuthSystem() {
  console.log('=== 🔍 認証システム完全チェック ===\n')

  try {
    // 1. Auth users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Auth users fetch error:', authError)
      return
    }

    console.log(`📊 Auth Users: ${users?.length || 0}`)

    // 2. User profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')

    console.log(`📊 User Profiles: ${profiles?.length || 0}\n`)

    // 3. Detailed user check
    console.log('=== 詳細なユーザー情報 ===\n')

    for (const user of users || []) {
      console.log(`👤 ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Provider: ${user.app_metadata?.provider || 'email'}`)
      console.log(`   Confirmed: ${user.email_confirmed_at ? '✅' : '❌ 未確認'}`)
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)

      // Check profile
      const profile = profiles?.find(p => p.id === user.id)
      if (profile) {
        console.log(`   Profile: ✅ ${profile.username}`)
      } else {
        console.log(`   Profile: ❌ なし`)
      }

      // Check if can login
      if (!user.email_confirmed_at && user.app_metadata?.provider === 'email') {
        console.log(`   ⚠️  メール確認が必要`)
      }

      console.log('')
    }

    // 4. Check for duplicates
    console.log('=== 重複チェック ===\n')
    const emailCounts = {}
    users?.forEach(user => {
      emailCounts[user.email] = (emailCounts[user.email] || 0) + 1
    })

    const duplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1)
    if (duplicates.length > 0) {
      console.log('⚠️  重複アカウント:')
      duplicates.forEach(([email, count]) => {
        console.log(`   ${email}: ${count}個`)
      })
    } else {
      console.log('✅ 重複なし')
    }

    // 5. Provider breakdown
    console.log('\n=== プロバイダー別 ===\n')
    const providers = {}
    users?.forEach(user => {
      const provider = user.app_metadata?.provider || 'email'
      providers[provider] = (providers[provider] || 0) + 1
    })

    Object.entries(providers).forEach(([provider, count]) => {
      console.log(`${provider}: ${count}`)
    })

    // 6. Recommendations
    console.log('\n=== 推奨事項 ===\n')

    const unconfirmed = users?.filter(u => !u.email_confirmed_at && u.app_metadata?.provider === 'email')
    if (unconfirmed?.length > 0) {
      console.log(`⚠️  ${unconfirmed.length}個の未確認メールアカウント`)
      console.log('   → Supabaseでメール確認を無効にするか、確認メールを送信')
    }

    const noProfiles = users?.filter(u => !profiles?.find(p => p.id === u.id))
    if (noProfiles?.length > 0) {
      console.log(`⚠️  ${noProfiles.length}個のプロファイルなしアカウント`)
    }

    console.log('\n✅ チェック完了')

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkAuthSystem().then(() => process.exit())