# Resendドメイン検証の必要性

## 🚨 現在の問題

エラーメッセージ:
```
450 You can only send testing emails to your own email address (kai.moriguchi1005@gmail.com).
To send emails to other recipients, please verify a domain at resend.com/domains
```

## 原因

ResendのAPIキーは**テストモード**のため、以下の制限があります:
- ✅ **kai.moriguchi1005@gmail.com** にのみ送信可能
- ❌ 他のメールアドレスには送信不可

## 解決方法

### オプション1: ドメイン検証（本番向け - 推奨）

1. **Resend Dashboardにログイン**
   https://resend.com/domains

2. **独自ドメインを追加**
   - 例: `openwardrobemarket.com`
   - または: `owm.dev`

3. **DNSレコードを設定**
   - SPFレコード
   - DKIMレコード
   - 検証完了まで待つ（通常数分）

4. **Supabase設定を更新**
   - Sender email: `noreply@yourdomain.com`に変更

### オプション2: 開発環境での回避策

#### 方法A: メール確認を無効化（即効性あり）
```
Supabase Dashboard → Authentication → Sign In / Providers
→ "Confirm email" をOFFにする
```

#### 方法B: 手動確認スクリプト使用
```bash
# アカウント作成後、手動で確認
node confirm-email-manually.mjs user@example.com
```

#### 方法C: kai.moriguchi1005@gmail.comでのみテスト
現在はこのアドレスでのみメール送信が成功します。

### オプション3: 別のSMTPプロバイダー

#### SendGrid（無料プランあり）
1. https://sendgrid.com でアカウント作成
2. APIキー取得
3. Supabase SMTP設定:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey`
   - Password: `[SendGrid APIキー]`

#### Mailgun（無料プランあり）
1. https://mailgun.com でアカウント作成
2. APIキー取得
3. ドメイン検証不要でサンドボックスドメインが使える

## 📋 当面の開発用設定

### 推奨: メール確認を無効化

1. Supabase Dashboard → Authentication → Sign In / Providers
2. "Confirm email" → **OFF**
3. Save

これで開発中はメール確認なしでログイン可能になります。

### 本番移行時のチェックリスト

- [ ] 独自ドメイン取得
- [ ] Resendでドメイン検証
- [ ] DNSレコード設定（SPF/DKIM）
- [ ] Sender emailを独自ドメインに変更
- [ ] メール確認を再度有効化
- [ ] 本番環境でテスト

## 現状まとめ

✅ **完了**:
- Resend SMTP設定は正常
- kai.moriguchi1005@gmail.com へのメール送信は成功

⚠️ **制限**:
- 他のメールアドレスには送信不可（ドメイン検証が必要）

🔧 **推奨対応**:
- 開発中: メール確認を無効化
- 本番前: ドメイン検証を完了