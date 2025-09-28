# メール確認設定ガイド

## 現在の状況

- ✅ アカウント作成フローが実装済み
- ✅ メール確認リンクが生成される
- ✅ 手動確認スクリプトが利用可能
- ⚠️ Supabaseのデフォルトメールサービスを使用中（制限あり）

## メール確認フロー

1. ユーザーがサインアップ → `SignupPage.tsx`
2. Supabaseがメール確認リンクを送信
3. ユーザーがメールのリンクをクリック
4. `/auth/callback`でトークンを検証
5. アカウントが有効化され、ログイン可能に

## 手動確認方法（開発用）

```bash
# 特定のメールアドレスを手動で確認
node confirm-email-manually.mjs test@example.com

# すべてのユーザー状況を確認
node check-auth-system.mjs
```

## Supabaseでメール送信を設定

### オプション1: Supabaseデフォルト（現在使用中）

**制限:**
- 1時間あたり3通まで
- 開発環境での制限

**設定場所:**
1. Supabase Dashboard → Authentication → Settings
2. Email Authセクションで「Enable email confirmations」を有効

### オプション2: カスタムSMTPサーバー（推奨）

**人気のSMTPプロバイダー:**
- SendGrid
- Resend
- AWS SES
- Mailgun

**設定手順（Resendの例）:**

1. Resendアカウントを作成: https://resend.com

2. APIキーを取得

3. Supabase Dashboard → Project Settings → Auth

4. SMTP設定を入力:
   ```
   Host: smtp.resend.com
   Port: 465
   Username: resend
   Password: [Your Resend API Key]
   Sender Email: noreply@yourdomain.com
   Sender Name: Open Wardrobe Market
   ```

5. テスト送信で確認

### オプション3: 開発環境でメール確認を無効化

**注意:** 本番環境では推奨されません

1. Supabase Dashboard → Authentication → Settings
2. 「Enable email confirmations」を無効化

## トラブルシューティング

### メールが届かない場合

1. **迷惑メールフォルダを確認**
   - GmailやOutlookは自動的に迷惑メールに分類することがある

2. **メール再送信**
   ```javascript
   // setup-email-confirmation.mjsを実行
   node setup-email-confirmation.mjs
   ```

3. **手動確認（開発のみ）**
   ```bash
   node confirm-email-manually.mjs user@example.com
   ```

### エラー: "Email rate limit exceeded"

- Supabaseの無料プランでは1時間3通の制限
- カスタムSMTPを設定するか、時間を置いて再試行

## 本番環境への移行チェックリスト

- [ ] カスタムSMTPサーバーを設定
- [ ] SPF/DKIMレコードを設定
- [ ] カスタムドメインからメールを送信
- [ ] メールテンプレートをカスタマイズ
- [ ] バウンス処理を実装
- [ ] メール送信ログを記録

## 関連ファイル

- `/src/app/components/SignupPage.tsx` - サインアップフォーム
- `/src/app/pages/auth/callback.tsx` - メール確認コールバック
- `/api/create-user-profile.ts` - プロファイル作成API
- `/setup-email-confirmation.mjs` - メール再送信スクリプト
- `/confirm-email-manually.mjs` - 手動確認スクリプト
- `/check-auth-system.mjs` - システムチェックスクリプト