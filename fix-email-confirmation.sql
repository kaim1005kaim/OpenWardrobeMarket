-- メール確認を無効にする（開発環境用）
-- Supabase Dashboard > Authentication > Settings > Email Auth で設定を変更

-- 既存の未確認ユーザーを確認済みにする
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 確認用：更新されたユーザーを表示
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC;