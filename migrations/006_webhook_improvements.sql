-- Webhook improvements and 4-card separation migration
-- Add event_log table for idempotency and webhook tracking

-- Create event_log table for webhook idempotency
CREATE TABLE IF NOT EXISTS event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ext_id text UNIQUE NOT NULL,  -- webhook event ID or jobId
  event_type text NOT NULL,     -- 'webhook.progress', 'webhook.completed', etc
  payload jsonb NOT NULL,       -- full webhook payload
  processed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_log_ext_id ON event_log(ext_id);
CREATE INDEX IF NOT EXISTS idx_event_log_processed ON event_log(processed);

-- Extend assets table for ImagineAPI integration
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS imagine_job_id text,
  ADD COLUMN IF NOT EXISTS imagine_image_index smallint, -- 1-4 for the 4 generated images
  ADD COLUMN IF NOT EXISTS width int,
  ADD COLUMN IF NOT EXISTS height int,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create index for imagine job lookups
CREATE INDEX IF NOT EXISTS idx_assets_imagine_job_id ON assets(imagine_job_id);

-- Update generation_history table for better webhook tracking
ALTER TABLE generation_history
  ADD COLUMN IF NOT EXISTS webhook_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_status text DEFAULT 'pending' CHECK (completion_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- Create job_sessions table for SSE session tracking
CREATE TABLE IF NOT EXISTS job_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  imagine_job_id text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_job_sessions_session_id ON job_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_job_sessions_imagine_job_id ON job_sessions(imagine_job_id);
CREATE INDEX IF NOT EXISTS idx_job_sessions_expires_at ON job_sessions(expires_at);

-- Add RLS policies for new tables
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sessions ENABLE ROW LEVEL SECURITY;

-- event_log is admin-only
CREATE POLICY "event_log_admin_only" ON event_log
  FOR ALL USING (false); -- Only accessible via service role

-- job_sessions can be accessed by the user who owns the session
CREATE POLICY "job_sessions_user_access" ON job_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM job_sessions 
  WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to upsert asset from ImagineAPI
CREATE OR REPLACE FUNCTION upsert_asset_from_imagine(
  p_job_id text,
  p_image_index int,
  p_image_url text,
  p_r2_url text,
  p_width int DEFAULT NULL,
  p_height int DEFAULT NULL,
  p_file_size bigint DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_asset_id uuid;
  v_gen_record record;
BEGIN
  -- Get the generation record
  SELECT * INTO v_gen_record 
  FROM generation_history 
  WHERE generation_data->>'job_id' = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generation record not found for job_id: %', p_job_id;
  END IF;
  
  -- Insert or update asset
  INSERT INTO assets (
    user_id,
    title,
    r2_url,
    r2_key,
    tags,
    colors,
    imagine_job_id,
    imagine_image_index,
    width,
    height,
    file_size,
    processing_status,
    is_public,
    created_at
  ) VALUES (
    v_gen_record.user_id,
    COALESCE(v_gen_record.generation_data->>'title', 'Generated Design'),
    p_r2_url,
    'generated/' || p_job_id || '_' || p_image_index || '.jpg',
    COALESCE(
      (v_gen_record.generation_data->'parameters'->>'tags')::text[], 
      ARRAY[]::text[]
    ),
    COALESCE(
      (v_gen_record.generation_data->'parameters'->>'colors')::text[], 
      ARRAY[]::text[]
    ),
    p_job_id,
    p_image_index,
    p_width,
    p_height,
    p_file_size,
    'completed',
    false, -- Not public by default
    now()
  )
  ON CONFLICT (imagine_job_id, imagine_image_index) 
  DO UPDATE SET
    r2_url = EXCLUDED.r2_url,
    width = COALESCE(EXCLUDED.width, assets.width),
    height = COALESCE(EXCLUDED.height, assets.height),
    file_size = COALESCE(EXCLUDED.file_size, assets.file_size),
    processing_status = EXCLUDED.processing_status,
    updated_at = now()
  RETURNING id INTO v_asset_id;
  
  RETURN v_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint to prevent duplicate assets per job/image
ALTER TABLE assets 
  ADD CONSTRAINT unique_imagine_job_image 
  UNIQUE (imagine_job_id, imagine_image_index) 
  DEFERRABLE INITIALLY DEFERRED;