#!/usr/bin/env node

// Test production deployment
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

async function testProduction() {
  console.log('🚀 Testing production deployment...\n');

  // 1. Check recent mappings
  console.log('📋 Checking recent task mappings...');
  const { data: mappings, error: mapError } = await supabase
    .from('imagine_task_map')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (mapError) {
    console.error('❌ Error fetching mappings:', mapError);
  } else if (mappings && mappings.length > 0) {
    console.log(`✅ Found ${mappings.length} recent mappings:`);
    mappings.forEach(m => {
      console.log(`  - task_id: ${m.task_id.substring(0, 8)}... -> job_id: ${m.job_id.substring(0, 20)}...`);
    });
  } else {
    console.log('⚠️  No mappings found yet');
  }

  // 2. Check recent events
  console.log('\n📊 Checking recent webhook events...');
  const { data: events, error: eventError } = await supabase
    .from('event_log')
    .select('id, job_id, event_type, progress, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (eventError) {
    console.error('❌ Error fetching events:', eventError);
  } else if (events && events.length > 0) {
    console.log(`✅ Found ${events.length} recent events:`);
    
    // Group by job_id
    const jobGroups = {};
    events.forEach(e => {
      if (!jobGroups[e.job_id]) {
        jobGroups[e.job_id] = [];
      }
      jobGroups[e.job_id].push(e);
    });
    
    Object.entries(jobGroups).forEach(([jobId, jobEvents]) => {
      console.log(`\n  Job: ${jobId ? jobId.substring(0, 20) + '...' : 'null'}`);
      jobEvents.forEach(e => {
        const time = new Date(e.created_at).toLocaleTimeString();
        console.log(`    - ${e.event_type} ${e.progress ? `(${e.progress}%)` : ''} at ${time}`);
      });
    });
  } else {
    console.log('⚠️  No events found yet');
  }

  // 3. Test production webhook with dummy data
  console.log('\n🧪 Testing production webhook endpoint...');
  
  const testTaskId = `prod-test-${Date.now()}`;
  const testJobId = `test-user:${Date.now()}-xyz789`;
  
  // First create mapping
  console.log('  Creating test mapping...');
  const { error: testMapError } = await supabase
    .from('imagine_task_map')
    .insert({
      task_id: testTaskId,
      job_id: testJobId
    });
    
  if (testMapError) {
    console.error('  ❌ Failed to create test mapping:', testMapError);
    return;
  }
  
  // Send test webhook
  console.log('  Sending test webhook to production...');
  const webhookUrl = 'https://open-wardrobe-market-2key79wyj-kais-projects-d82b3656.vercel.app/api/imagine-webhook';
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request: "imagine.image.update",
        status: "completed",
        id: testTaskId,
        result: {
          urls: ["https://test.com/1.jpg", "https://test.com/2.jpg"],
          upscaled_urls: ["https://test.com/1_up.jpg"]
        }
      })
    });
    
    console.log('  Response:', response.status, response.statusText);
    
    // Wait and check if event was saved
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: testEvent } = await supabase
      .from('event_log')
      .select('*')
      .eq('job_id', testJobId)
      .single();
      
    if (testEvent) {
      console.log('  ✅ Test event was processed successfully!');
      console.log('    - event_type:', testEvent.event_type);
      console.log('    - result_urls:', testEvent.result_urls?.length, 'images');
      
      // Clean up
      await supabase.from('event_log').delete().eq('job_id', testJobId);
      await supabase.from('imagine_task_map').delete().eq('task_id', testTaskId);
      console.log('  🧹 Test data cleaned up');
    } else {
      console.log('  ❌ Test event was not found in database');
    }
  } catch (err) {
    console.error('  ❌ Webhook test failed:', err.message);
  }

  console.log('\n✅ Production test complete!');
}

testProduction().catch(console.error);