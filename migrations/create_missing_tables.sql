-- Create missing tables for webhook-SSE flow
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Create event_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS event_log (
  id bigserial PRIMARY KEY,
  ext_id text UNIQUE,
  job_id text,
  image_id text,
  event_type text,
  progress int,
  preview_url text,
  result_urls text[],
  upscaled_urls text[],
  error_message text,
  payload jsonb,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for event_log
CREATE INDEX IF NOT EXISTS idx_event_log_jobid_id ON event_log(job_id, id);
CREATE INDEX IF NOT EXISTS idx_event_log_jobid_created ON event_log(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_processed ON event_log(processed);
CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);

-- 2. Create imagine_task_map table for ID mapping
CREATE TABLE IF NOT EXISTS imagine_task_map (
  id bigserial PRIMARY KEY,
  task_id text UNIQUE NOT NULL,  -- ImagineAPI's image_id
  job_id text NOT NULL,           -- App's job_id (user_id:requestId format)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for imagine_task_map
CREATE INDEX IF NOT EXISTS idx_imagine_task_map_task_id ON imagine_task_map(task_id);
CREATE INDEX IF NOT EXISTS idx_imagine_task_map_job_id ON imagine_task_map(job_id);

-- 3. Enable RLS and create policies
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagine_task_map ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS p_event_log_read_by_job ON event_log;
DROP POLICY IF EXISTS p_imagine_task_map_read ON imagine_task_map;
DROP POLICY IF EXISTS p_imagine_task_map_insert ON imagine_task_map;
DROP POLICY IF EXISTS p_imagine_task_map_update ON imagine_task_map;

-- Create new policies for event_log (allow read access for SSE)
CREATE POLICY p_event_log_read_by_job 
ON event_log FOR SELECT
TO anon, authenticated
USING (true);  -- MVP: allow all reads

-- Create policies for imagine_task_map
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

-- 4. Grant necessary permissions
GRANT ALL ON event_log TO anon, authenticated;
GRANT ALL ON imagine_task_map TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE event_log_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE imagine_task_map_id_seq TO anon, authenticated;

-- 5. Verify tables were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_log') THEN
    RAISE NOTICE '✅ event_log table created successfully';
  ELSE
    RAISE NOTICE '❌ event_log table creation failed';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imagine_task_map') THEN
    RAISE NOTICE '✅ imagine_task_map table created successfully';
  ELSE
    RAISE NOTICE '❌ imagine_task_map table creation failed';
  END IF;
END $$;