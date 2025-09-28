# Supabase カスタムSMTP設定完了ガイド

## ✅ 完了した作業

1. **ResendのAPIキー設定済み**
   - APIキー: `.env.local`に保存済み
   - テストメール送信: 成功

2. **メールバウンス対策実装済み**
   - メールアドレスバリデーション強化
   - テストメールパターンをブロック
   - 無効なメールアドレスを事前に拒否

## 🔧 Supabaseで必要な設定

### Supabase Dashboardでの手順:

1. **ログイン**
   ```
   https://supabase.com/dashboard/project/etvmigcsvrvetemyeiez
   ```

2. **設定画面へ移動**
   ```
   Project Settings → Authentication → SMTP Settings
   ```

3. **以下を入力して保存**

   | 項目 | 値 |
   |------|-----|
   | Enable custom SMTP | ✅ ON |
   | **Host** | `smtp.resend.com` |
   | **Port number** | `465` |
   | **Minimum interval** | `0` または `1` |
   | **Sender email** | `onboarding@resend.dev` |
   | **Sender name** | `Open Wardrobe Market` |
   | **Username** | `resend` |
   | **Password** | `re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP` |

4. **「Save」をクリック**

## 📧 設定後のテスト

1. **新規アカウントを作成**
   - 有効なメールアドレスを使用
   - 例: 個人のGmailアドレス

2. **メール確認**
   - 確認メールが届くことを確認
   - SPAMフォルダも確認

3. **アカウント有効化**
   - メール内のリンクをクリック
   - ログインできることを確認

## ⚠️ Supabaseからの警告への対応

Supabaseから高いバウンス率の警告を受けました。以下の対策を実装済み:

### 実装済みの対策:
- ✅ カスタムSMTPプロバイダー（Resend）を設定
- ✅ メールアドレスの厳密な検証
- ✅ テスト用メールパターンのブロック
- ✅ 無効なメール形式を事前に拒否

### 今後の注意事項:
- 実在するメールアドレスのみでテスト
- `test@test.com`等の一般的なアドレスは使用しない
- 開発時は自分のメールアドレスを使用

## 📊 メール送信状況の監視

### Resend Dashboard
```
https://resend.com/emails
```
- 送信ログ確認
- バウンス率の監視
- エラーのトラッキング

### Supabase Auth Logs
```
Dashboard → Authentication → Logs
```
- 認証エラーの確認
- メール送信失敗の追跡

## 🚀 次のステップ

1. **独自ドメインの設定**（本番環境用）
   - Resendでドメイン追加
   - DNS設定（SPF/DKIM）
   - `noreply@yourdomain.com`から送信

2. **メールテンプレートのカスタマイズ**
   - Supabase Email Templates
   - ブランドに合わせたデザイン

3. **監視とアラート**
   - バウンス率の定期確認
   - 送信失敗の自動通知

## 📞 サポート

問題が発生した場合:
- Resendサポート: support@resend.com
- Supabaseサポート: Dashboard内のサポートチャット