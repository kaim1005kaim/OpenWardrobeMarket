# Resend SMTP設定手順

## Supabase Dashboardでの設定

1. **Supabase Dashboardにログイン**
   - https://supabase.com/dashboard/project/etvmigcsvrvetemyeiez

2. **Project Settings → Authentication → SMTP Settings**

3. **以下の設定を入力:**

```
Enable custom SMTP: ✅ ON

Host: smtp.resend.com
Port number: 465
Minimum interval between emails: 0 (or 1)

Sender details:
  Sender email: onboarding@resend.dev
  Sender name: Open Wardrobe Market

SMTP credentials:
  Username: resend
  Password: re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP
```

4. **Save をクリック**

## 重要な注意事項

### メールアドレスについて
- **開発環境**: `onboarding@resend.dev` を使用（Resendのデフォルト送信元）
- **本番環境**: 独自ドメインを設定後、`noreply@yourdomain.com` に変更

### 独自ドメインの設定（後で必要）
1. Resend Dashboard → Domains → Add Domain
2. DNSレコードを設定
3. ドメイン確認後、そのドメインから送信可能

## テスト手順

1. **新しいテストアカウントを作成**
2. **メールが届くか確認**
3. **確認リンクをクリックしてアカウント有効化**

## バウンス対策

### 開発時の注意
- ❌ 存在しないメールアドレスでテストしない
- ❌ `test@test.com` のような一般的なアドレスを使わない
- ✅ 実際のメールアドレスか、専用のテストアドレスを使用

### 推奨テストアドレス
- 自分のGmailアドレス
- 一時メールサービス（10minutemail等）
- Mailinator等のテストメールサービス

## トラブルシューティング

### エラー: Authentication failed
- APIキーが正しいか確認
- Usernameが `resend` になっているか確認

### エラー: Connection timeout
- Port番号が 465 になっているか確認
- ファイアウォール設定を確認

### メールが届かない
1. Resend Dashboard でメール送信ログを確認
2. Supabase Auth Logs を確認
3. SPAMフォルダを確認

## 設定完了後のチェックリスト
- [ ] SMTP設定を保存
- [ ] テストメール送信成功
- [ ] 確認メールが届く
- [ ] アカウント有効化が動作する
- [ ] バウンスレートが改善