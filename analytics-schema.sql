-- 分析機能のためのデータベース拡張

-- published_itemsテーブルにビュー数カラムを追加（存在しない場合）
ALTER TABLE published_items 
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- generation_historyテーブルの拡張
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS generation_time INTEGER DEFAULT 0, -- 生成にかかった時間（秒）
ADD COLUMN IF NOT EXISTS style_tags TEXT[], -- スタイルタグの配列
ADD COLUMN IF NOT EXISTS color_tags TEXT[]; -- カラータグの配列

-- 分析データを効率化するためのインデックス
CREATE INDEX IF NOT EXISTS idx_published_items_user_created 
ON published_items(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_published_items_user_public 
ON published_items(user_id, is_public);

CREATE INDEX IF NOT EXISTS idx_generation_history_user_created 
ON generation_history(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_published_items_likes 
ON published_items(likes);

CREATE INDEX IF NOT EXISTS idx_published_items_views 
ON published_items(views);

-- ビュー数を追跡するためのトリガー（オプション）
-- 実際の使用では、アプリケーションレベルで管理することを推奨

-- 分析用のマテリアライズドビュー（パフォーマンス向上のため）
CREATE MATERIALIZED VIEW IF NOT EXISTS user_analytics_summary AS
SELECT 
    user_id,
    COUNT(*) as total_generations,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_generations,
    AVG(CASE WHEN generation_time > 0 THEN generation_time END) as avg_generation_time,
    updated_at
FROM generation_history
GROUP BY user_id, updated_at;

CREATE MATERIALIZED VIEW IF NOT EXISTS marketplace_analytics_summary AS
SELECT 
    user_id,
    COUNT(*) as published_count,
    SUM(likes) as total_likes,
    SUM(views) as total_views,
    AVG(likes::float) as avg_likes,
    AVG(views::float) as avg_views,
    AVG(price::float) as avg_price,
    updated_at
FROM published_items
WHERE is_public = true
GROUP BY user_id, updated_at;

-- マテリアライズドビューのインデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_analytics_summary_user 
ON user_analytics_summary(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_analytics_summary_user 
ON marketplace_analytics_summary(user_id);

-- 分析データの更新頻度を管理するテーブル
CREATE TABLE IF NOT EXISTS analytics_refresh_log (
    id SERIAL PRIMARY KEY,
    view_name TEXT NOT NULL,
    last_refreshed TIMESTAMPTZ DEFAULT NOW(),
    refresh_duration_ms INTEGER,
    success BOOLEAN DEFAULT true
);

-- RLS (Row Level Security) ポリシーの設定
ALTER TABLE analytics_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read analytics refresh log" ON analytics_refresh_log
    FOR SELECT USING (true); -- 管理者のみアクセス可能にする場合は条件を変更

-- 関数: マテリアライズドビューの定期更新
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    duration_ms INTEGER;
BEGIN
    -- user_analytics_summaryの更新
    start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_analytics_summary;
    end_time := NOW();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    INSERT INTO analytics_refresh_log (view_name, last_refreshed, refresh_duration_ms, success)
    VALUES ('user_analytics_summary', end_time, duration_ms, true);
    
    -- marketplace_analytics_summaryの更新
    start_time := NOW();
    REFRESH MATERIALIZED VIEW CONCURRENTLY marketplace_analytics_summary;
    end_time := NOW();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    INSERT INTO analytics_refresh_log (view_name, last_refreshed, refresh_duration_ms, success)
    VALUES ('marketplace_analytics_summary', end_time, duration_ms, true);
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO analytics_refresh_log (view_name, last_refreshed, success)
    VALUES ('refresh_error', NOW(), false);
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 定期実行のコメント（実際の本番環境では cron や外部スケジューラーを使用）
-- SELECT cron.schedule('refresh-analytics', '0 */6 * * *', 'SELECT refresh_analytics_views();'); -- 6時間ごと

-- テスト用サンプルデータの挿入（開発環境用）
-- INSERT INTO analytics_refresh_log (view_name, last_refreshed, refresh_duration_ms)
-- VALUES ('initial_setup', NOW(), 0);

COMMENT ON TABLE analytics_refresh_log IS '分析データの更新ログを管理';
COMMENT ON FUNCTION refresh_analytics_views() IS 'マテリアライズドビューを更新し、パフォーマンスを向上';
COMMENT ON MATERIALIZED VIEW user_analytics_summary IS 'ユーザー別の生成統計サマリー';
COMMENT ON MATERIALIZED VIEW marketplace_analytics_summary IS 'マーケットプレイス統計サマリー';