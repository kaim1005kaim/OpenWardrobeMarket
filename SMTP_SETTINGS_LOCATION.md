# Supabase SMTP設定の場所

## 現在のSupabase Dashboard構造

SMTP設定は以下の場所にあります：

### 方法1: Email設定から
1. **Authentication** セクション（現在表示中）
2. 左サイドバーの **「Emails」** タブをクリック
3. ページ下部に **「SMTP Settings」** セクションがあります

### 方法2: プロジェクト設定から
1. 左サイドバー最下部の **「Project Settings」**（歯車アイコン）
2. **「Authentication」** をクリック
3. **「Email」** タブを選択
4. スクロールダウンして **「SMTP Settings」** を探す

### 方法3: 直接URLアクセス
```
https://supabase.com/dashboard/project/etvmigcsvrvetemyeiez/auth/email-templates
```
このページの下部にSMTP設定があります

## 📍 具体的な手順

1. 現在のAuthentication画面から
2. 左サイドバーの **「Emails」** をクリック（Sign In / Providersの下）
3. ページを下にスクロール
4. **「Custom SMTP」** セクションを探す
5. **「Enable Custom SMTP」** をONにする

## 設定する値

| 項目 | 値 |
|------|-----|
| **Enable custom SMTP** | ✅ ON |
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | `re_6aihd5ct_GigqMfhqXzyBzJLFqAk7tjLP` |
| **Sender email** | `onboarding@resend.dev` |
| **Sender name** | `Open Wardrobe Market` |

## 注意事項

- UIが頻繁に更新されるため、場所が変わる可能性があります
- 「Emails」タブが見つからない場合は「Email Templates」を探してください
- SMTP設定は通常、Email関連の設定の一番下にあります