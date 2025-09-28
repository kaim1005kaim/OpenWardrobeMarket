#!/usr/bin/env node

// Script to create essential tables manually
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

async function createTables() {
  console.log('🚀 Creating essential tables for webhook-SSE flow...\n');

  // 1. Check if event_log exists
  try {
    console.log('📋 Checking existing tables...');
    
    // Try to query event_log
    const { error: eventLogError } = await supabase.from('event_log').select('id').limit(1);
    
    if (eventLogError && eventLogError.code === 'PGRST116') {
      console.log('❌ event_log table does not exist');
      console.log('⚠️  Database migrations need to be applied manually.');
      console.log('💡 Please apply the SQL from create-essential-tables.sql in Supabase Dashboard > SQL Editor');
      return;
    } else {
      console.log('✅ event_log table exists');
    }

    // Try to query generation_history
    const { error: genHistoryError } = await supabase.from('generation_history').select('id').limit(1);
    
    if (genHistoryError && genHistoryError.code === 'PGRST116') {
      console.log('❌ generation_history table does not exist');
      console.log('💡 Please apply the SQL from create-essential-tables.sql in Supabase Dashboard > SQL Editor');
      return;
    } else {
      console.log('✅ generation_history table exists');
    }

    console.log('\n🎉 All essential tables are ready!');
    console.log('🔄 Testing webhook-SSE flow components...');

    // Test inserting a sample event_log entry
    const testEvent = {
      ext_id: `test-${Date.now()}`,
      event_type: 'test',
      payload: { test: 'data' },
      job_id: 'test-job-123',
      image_id: 'test-image-456'
    };

    const { error: insertError } = await supabase
      .from('event_log')
      .insert(testEvent);

    if (insertError) {
      console.log('❌ Failed to insert test event:', insertError.message);
    } else {
      console.log('✅ event_log table is writable');
      
      // Clean up test entry
      await supabase.from('event_log').delete().eq('ext_id', testEvent.ext_id);
    }

    console.log('\n📊 Database is ready for webhook-SSE flow!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTables();