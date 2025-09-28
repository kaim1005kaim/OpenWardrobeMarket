# Resendを使用したSMTP設定ガイド

## なぜResendを使うか
- **無料プラン**: 月3000通まで無料
- **簡単セットアップ**: 5分で設定完了
- **高い到達率**: メールが迷惑メールに入りにくい
- **日本語サポート**: ドキュメントが充実

## 設定手順

### 1. Resendアカウント作成
1. https://resend.com にアクセス
2. 「Start for free」をクリック
3. GitHubまたはメールでサインアップ

### 2. APIキーを取得
1. ダッシュボードにログイン
2. 左側メニューの「API Keys」をクリック
3. 「Create API Key」をクリック
4. 名前を入力（例：「OWM Production」）
5. APIキーをコピー（re_から始まる文字列）

### 3. Supabaseに設定

#### Supabase Dashboard設定
1. Supabase Dashboardにログイン
2. Project Settings → Authentication → Email Auth

#### SMTP設定を入力:
```
Host: smtp.resend.com
Port: 465
Username: resend
Password: [あなたのResend APIキー]
Sender email: noreply@openwardrobemarket.com
Sender name: Open Wardrobe Market
```

### 4. ドメイン検証（オプションだが推奨）
独自ドメインから送信する場合:
1. Resend Dashboard → Domains
2. 「Add Domain」をクリック
3. ドメイン名を入力
4. DNSレコードを設定

## 代替: SendGridを使用

### SendGrid無料プラン
- 月100通まで無料
- 設定がやや複雑

### 設定手順
1. https://sendgrid.com でアカウント作成
2. Settings → API Keys でAPIキー作成
3. Supabase SMTP設定:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [SendGrid APIキー]
```

## 開発環境での即時解決策

### 方法1: メール確認を手動で実行
```bash
# 特定のユーザーを確認
node confirm-email-manually.mjs user@example.com
```

### 方法2: メール確認を一時的に無効化
1. Supabase Dashboard → Authentication → Settings
2. 「Enable email confirmations」のチェックを外す
3. **注意**: 本番環境では再度有効にすること

### 方法3: Inbucketを使用（ローカルメールサーバー）
```bash
# Dockerでローカルメールサーバーを起動
docker run -d --name inbucket \
  -p 9000:9000 -p 2500:2500 -p 1100:1100 \
  inbucket/inbucket

# Supabase設定
Host: host.docker.internal
Port: 2500
Username: (空)
Password: (空)

# メールを確認
http://localhost:9000
```

## トラブルシューティング

### エラー: "Rate limit exceeded"
- Supabaseデフォルト: 1時間3通の制限
- 解決: カスタムSMTP設定

### エラー: "Email not delivered"
1. SPAMフォルダを確認
2. Supabase Email Templates を確認
3. SMTP設定を再確認

### メールが届かない
1. Supabase Logs → Auth でエラーを確認
2. SMTP認証情報を確認
3. ファイアウォール/ポート制限を確認

## 本番環境チェックリスト
- [ ] カスタムSMTP設定完了
- [ ] SPF/DKIM設定完了
- [ ] 独自ドメインから送信
- [ ] バウンス処理実装
- [ ] 送信ログ記録
- [ ] レート制限対策