-- 開発環境用: メール確認を不要にする設定
-- 警告: 本番環境では使用しないこと！

-- 既存の未確認ユーザーをすべて確認済みにする
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 確認結果を表示
SELECT
  email,
  email_confirmed_at,
  CASE
    WHEN email_confirmed_at IS NOT NULL THEN '✅ 確認済み'
    ELSE '❌ 未確認'
  END as status
FROM auth.users
ORDER BY created_at DESC;

-- メモ:
-- Supabase Dashboard → Authentication → Settings で
-- "Enable email confirmations" のチェックを外すと
-- 新規ユーザーは自動的に確認済みになります