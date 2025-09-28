#!/usr/bin/env node

// Test webhook flow - simulating ImagineAPI webhook
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

async function testWebhookFlow() {
  console.log('🚀 Testing webhook flow...\n');

  // 1. Create a test mapping
  const testTaskId = `test-${Date.now()}`;
  const testJobId = `test-user:${Date.now()}-abcdef123456`;
  
  console.log('📋 Creating test mapping...');
  console.log('  task_id:', testTaskId);
  console.log('  job_id:', testJobId);
  
  const { error: mapError } = await supabase
    .from('imagine_task_map')
    .insert({
      task_id: testTaskId,
      job_id: testJobId
    });
    
  if (mapError) {
    console.error('❌ Failed to create mapping:', mapError);
    return;
  }
  console.log('✅ Mapping created\n');

  // 2. Simulate webhook progress event
  console.log('📡 Simulating webhook progress event...');
  
  const progressPayload = {
    request: "imagine.image.update",
    status: "in-progress",
    id: testTaskId,
    progress: 50,
    url: "https://example.com/preview.jpg"
  };
  
  const progressResponse = await fetch('http://localhost:3000/api/imagine-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progressPayload)
  });
  
  console.log('  Response:', progressResponse.status, progressResponse.statusText);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 3. Check if progress event was saved
  console.log('\n📊 Checking database for progress event...');
  
  const { data: progressEvents } = await supabase
    .from('event_log')
    .select('*')
    .eq('job_id', testJobId)
    .eq('event_type', 'progress');
    
  if (progressEvents && progressEvents.length > 0) {
    console.log('✅ Progress event found:');
    console.log('  - progress:', progressEvents[0].progress);
    console.log('  - preview_url:', progressEvents[0].preview_url);
  } else {
    console.log('❌ No progress event found');
  }
  
  // 4. Simulate webhook completed event
  console.log('\n📡 Simulating webhook completed event...');
  
  const completedPayload = {
    request: "imagine.image.update",
    status: "completed",
    id: testTaskId,
    result: {
      urls: [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg",
        "https://example.com/image3.jpg",
        "https://example.com/image4.jpg"
      ],
      upscaled_urls: [
        "https://example.com/image1_upscaled.jpg"
      ]
    }
  };
  
  const completedResponse = await fetch('http://localhost:3000/api/imagine-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(completedPayload)
  });
  
  console.log('  Response:', completedResponse.status, completedResponse.statusText);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 5. Check if completed event was saved
  console.log('\n📊 Checking database for completed event...');
  
  const { data: completedEvents } = await supabase
    .from('event_log')
    .select('*')
    .eq('job_id', testJobId)
    .eq('event_type', 'completed');
    
  if (completedEvents && completedEvents.length > 0) {
    console.log('✅ Completed event found:');
    console.log('  - result_urls:', completedEvents[0].result_urls);
    console.log('  - upscaled_urls:', completedEvents[0].upscaled_urls);
  } else {
    console.log('❌ No completed event found');
  }
  
  // 6. Test SSE endpoint
  console.log('\n🔄 Testing SSE endpoint...');
  console.log('  URL:', `http://localhost:3000/api/sse/generation/${encodeURIComponent(testJobId)}`);
  
  // Clean up test data
  console.log('\n🧹 Cleaning up test data...');
  
  await supabase.from('event_log').delete().eq('job_id', testJobId);
  await supabase.from('imagine_task_map').delete().eq('task_id', testTaskId);
  
  console.log('✅ Test complete!');
}

testWebhookFlow().catch(console.error);