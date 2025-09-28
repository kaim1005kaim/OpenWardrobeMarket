# SMTP設定入力ガイド

## 入力する値

### Sender details（送信者詳細）
- **Sender email**: `onboarding@resend.dev`
- **Sender name**: `Open Wardrobe Market`

### SMTP Provider Settings（SMTPプロバイダー設定）
- **Host**: `smtp.resend.com`
- **Port number**: `465`（すでに入力済み）
- **Minimum interval between emails**: `1`（または`0`）
- **Username**: `resend`
- **Password**: `re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP`

## ⚠️ 警告メッセージについて

「All fields below must be filled」というメッセージが表示されています。
以下のフィールドをすべて埋める必要があります：

1. **Sender email** を `onboarding@resend.dev` に変更
2. **Username** を `resend` に変更（現在長い文字列が入っている）
3. **Password** に `re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP` を入力

## 手順

1. 各フィールドに上記の値を正確に入力
2. すべてのフィールドが埋まっていることを確認
3. ページ下部の「Save」ボタンをクリック

## 設定後のテスト

1. 新規アカウント作成を試みる
2. 確認メールが届くことを確認
3. メール内のリンクでアカウントを有効化

## トラブルシューティング

もし保存後にエラーが出た場合：
- Resend APIキーが有効か確認
- ポート番号が465になっているか確認
- すべてのフィールドが正しく入力されているか再確認