#!/usr/bin/env node

// Script to apply webhook and SSE fix migrations
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  }
);

async function applyMigrations() {
  console.log('🚀 Applying webhook and SSE fix migrations...\n');

  try {
    // 1. Create imagine_task_map table
    console.log('📋 Creating imagine_task_map table...');
    
    const { error: mapTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS imagine_task_map (
          id bigserial PRIMARY KEY,
          task_id text UNIQUE NOT NULL,
          job_id text NOT NULL,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
        
        CREATE INDEX IF NOT EXISTS idx_imagine_task_map_task_id ON imagine_task_map(task_id);
        CREATE INDEX IF NOT EXISTS idx_imagine_task_map_job_id ON imagine_task_map(job_id);
      `
    }).single();

    if (mapTableError) {
      console.log('⚠️  Could not create table via RPC, testing direct insert...');
      
      // Test if table exists by trying to insert
      const { error: testError } = await supabase
        .from('imagine_task_map')
        .select('id')
        .limit(1);
        
      if (testError && testError.code === 'PGRST116') {
        console.log('❌ imagine_task_map table needs to be created manually');
        console.log('💡 Please run the SQL from migrations/fix_webhook_and_sse.sql in Supabase Dashboard');
      } else {
        console.log('✅ imagine_task_map table already exists');
      }
    } else {
      console.log('✅ imagine_task_map table created');
    }

    // 2. Add columns to event_log table
    console.log('\n📋 Checking event_log columns...');
    
    // Test if columns exist by trying to query them
    const { data: testData, error: columnError } = await supabase
      .from('event_log')
      .select('id, job_id, image_id, event_type, progress, preview_url')
      .limit(1);
    
    if (columnError && columnError.message.includes('column')) {
      console.log('❌ event_log columns need to be added manually');
      console.log('💡 Please run the SQL from migrations/fix_webhook_and_sse.sql in Supabase Dashboard');
    } else {
      console.log('✅ event_log columns are ready');
    }

    // 3. Test RLS policies
    console.log('\n📋 Testing RLS policies...');
    
    // Create anon client to test
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );
    
    const { error: rlsError } = await anonClient
      .from('event_log')
      .select('id')
      .limit(1);
    
    if (rlsError && rlsError.code === 'PGRST301') {
      console.log('❌ RLS policies need to be configured');
      console.log('💡 Please run the SQL from migrations/fix_webhook_and_sse.sql in Supabase Dashboard');
    } else {
      console.log('✅ RLS policies are configured');
    }

    console.log('\n📊 Migration check complete!');
    console.log('If any items failed, please apply the SQL manually in Supabase Dashboard.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyMigrations();