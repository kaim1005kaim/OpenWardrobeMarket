import { Resend } from 'resend'

// ResendのAPIキー
const resend = new Resend('re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP')

async function testResendEmail() {
  console.log('=== 📧 Resendメール送信テスト ===\n')

  try {
    console.log('テストメール送信中...')

    const { data, error } = await resend.emails.send({
      from: 'Open Wardrobe Market <onboarding@resend.dev>',
      to: ['kai.moriguchi1005@gmail.com'], // テスト用に送信先を設定
      subject: 'OWM - Resend設定テスト',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Open Wardrobe Market</h1>
          <p>このメールは、ResendのSMTP設定テストです。</p>
          <p>このメールが届いた場合、Resend設定は正常に動作しています。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <h2 style="color: #666;">次のステップ:</h2>
          <ol>
            <li>Supabase DashboardでSMTP設定を更新</li>
            <li>新規アカウント作成をテスト</li>
            <li>確認メールが届くことを確認</li>
          </ol>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            © 2025 Open Wardrobe Market
          </p>
        </div>
      `
    })

    if (error) {
      console.error('❌ エラー:', error)
      return
    }

    console.log('\n✅ メール送信成功!')
    console.log('  メールID:', data?.id)
    console.log('  送信先: kai.moriguchi1005@gmail.com')
    console.log('\nメールボックスを確認してください。')

    console.log('\n=== Supabase SMTP設定 ===\n')
    console.log('以下の設定をSupabase Dashboardに入力:')
    console.log('```')
    console.log('Host: smtp.resend.com')
    console.log('Port: 465')
    console.log('Username: resend')
    console.log('Password: re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP')
    console.log('Sender email: onboarding@resend.dev')
    console.log('Sender name: Open Wardrobe Market')
    console.log('```')

  } catch (err) {
    console.error('❌ 予期しないエラー:', err)
  }
}

testResendEmail().then(() => process.exit())