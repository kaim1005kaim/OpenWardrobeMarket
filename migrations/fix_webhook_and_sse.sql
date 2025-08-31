-- 1. imagine_task_map テーブル作成（image_id ↔ job_id のマッピング）
CREATE TABLE IF NOT EXISTS imagine_task_map (
  id bigserial PRIMARY KEY,
  task_id text UNIQUE NOT NULL,  -- ImagineAPI の image_id
  job_id text NOT NULL,           -- アプリ側の job_id (9439e7b2-...:1756659620441-...)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imagine_task_map_task_id ON imagine_task_map(task_id);
CREATE INDEX IF NOT EXISTS idx_imagine_task_map_job_id ON imagine_task_map(job_id);

-- 2. event_log テーブルにカラムを追加
ALTER TABLE event_log 
  ADD COLUMN IF NOT EXISTS job_id text,
  ADD COLUMN IF NOT EXISTS image_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS progress int,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS result_urls text[],
  ADD COLUMN IF NOT EXISTS upscaled_urls text[],
  ADD COLUMN IF NOT EXISTS error_message text;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_event_log_jobid_id ON event_log(job_id, id);
CREATE INDEX IF NOT EXISTS idx_event_log_jobid_created ON event_log(job_id, created_at DESC);

-- 3. RLS ポリシー追加（SSEが読めるように）
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（あれば）
DROP POLICY IF EXISTS p_event_log_read_by_job ON event_log;

-- 新しいポリシー作成（anon keyでも読める）
CREATE POLICY p_event_log_read_by_job 
ON event_log FOR SELECT
TO anon, authenticated
USING (true);  -- MVPなので全公開（本番では job_id での制限を追加）

-- 4. imagine_task_map にもRLSポリシー
ALTER TABLE imagine_task_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_imagine_task_map_read 
ON imagine_task_map FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY p_imagine_task_map_insert
ON imagine_task_map FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY p_imagine_task_map_update
ON imagine_task_map FOR UPDATE
TO anon, authenticated
USING (true);