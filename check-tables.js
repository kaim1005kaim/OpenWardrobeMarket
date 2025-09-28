#!/usr/bin/env node

// Check if all required tables exist
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function checkTables() {
  console.log('🔍 Checking database tables...\n');

  // Tables to check
  const tables = [
    'event_log',
    'generation_history',
    'imagine_task_map'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        console.log(`❌ ${table}: Does not exist`);
      } else if (error && error.code === 'PGRST205') {
        console.log(`❌ ${table}: Not in schema cache (table may not exist)`);
      } else if (error) {
        console.log(`⚠️  ${table}: Error - ${error.message}`);
      } else {
        console.log(`✅ ${table}: Exists and accessible`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  // Check event_log columns
  console.log('\n📊 Checking event_log columns...');
  
  try {
    const { data, error } = await supabase
      .from('event_log')
      .select('id, job_id, image_id, event_type, progress, preview_url, result_urls, upscaled_urls, error_message')
      .limit(1);
    
    if (error) {
      console.log(`❌ Cannot query columns: ${error.message}`);
    } else {
      console.log('✅ All required columns exist');
    }
  } catch (err) {
    console.log(`❌ Error checking columns: ${err.message}`);
  }

  console.log('\n💡 If tables are missing, please run the SQL from migrations/fix_webhook_and_sse.sql in Supabase Dashboard');
}

checkTables();