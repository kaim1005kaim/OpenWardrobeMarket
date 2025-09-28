-- Essential tables for webhook-SSE flow

-- 1. Create event_log table
CREATE TABLE IF NOT EXISTS event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ext_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  job_id text,  -- Add job_id column for SSE lookups
  image_id text -- Add image_id column for webhook lookups
);

-- 2. Create indexes for event_log
CREATE INDEX IF NOT EXISTS idx_event_log_ext_id ON event_log(ext_id);
CREATE INDEX IF NOT EXISTS idx_event_log_processed ON event_log(processed);
CREATE INDEX IF NOT EXISTS idx_event_log_job_id ON event_log(job_id);
CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);

-- 3. Create generation_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  generation_data jsonb NOT NULL,
  webhook_received_at timestamptz,
  completion_status text DEFAULT 'pending' CHECK (completion_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create job_sessions table for SSE tracking
CREATE TABLE IF NOT EXISTS job_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  imagine_job_id text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

-- 5. Create indexes for generation_history and job_sessions
CREATE INDEX IF NOT EXISTS idx_generation_history_user_id ON generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_sessions_session_id ON job_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_job_sessions_imagine_job_id ON job_sessions(imagine_job_id);

-- 6. Enable RLS
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sessions ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
DROP POLICY IF EXISTS "event_log_admin_only" ON event_log;
CREATE POLICY "event_log_admin_only" ON event_log FOR ALL USING (false);

DROP POLICY IF EXISTS "generation_history_user_access" ON generation_history;
CREATE POLICY "generation_history_user_access" ON generation_history FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "job_sessions_user_access" ON job_sessions;
CREATE POLICY "job_sessions_user_access" ON job_sessions FOR ALL USING (auth.uid() = user_id);